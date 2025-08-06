import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getGlobalConfig } from './config';

/**
 * 客户端注册信息
 */
export interface ClientRegistration {
    workspacePath: string;
    workspaceName: string;
    clientId: string;
    pid: number; // VSCode进程ID，用于检测窗口关闭
}

/**
 * 共享服务器管理器 - 单例模式
 * 负责管理全局唯一的MCP服务器进程
 */
export class SharedServerManager {
    private static instance: SharedServerManager;
    private serverProcess: ChildProcess | undefined;
    private isStarting = false;
    private isStarted = false;
    private isExternalServer = false; // 标记是否是外部已存在的服务器
    private registeredClients = new Map<string, ClientRegistration>();
    private readonly lockFilePath: string;

    private constructor() {
        this.lockFilePath = path.join(os.tmpdir(), 'source-navigator-server.lock');
        this.setupProcessEventHandlers();
    }

    static getInstance(): SharedServerManager {
        if (!SharedServerManager.instance) {
            SharedServerManager.instance = new SharedServerManager();
        }
        return SharedServerManager.instance;
    }

    /**
     * 注册客户端（VSCode窗口）
     */
    async registerClient(registration: ClientRegistration): Promise<void> {
        console.log(`[Shared Server] 注册客户端: ${registration.workspaceName} (${registration.clientId})`);
        
        // 确保服务器可用
        await this.ensureServerAvailable();
        
        // 注册客户端
        this.registeredClients.set(registration.clientId, registration);
        
        // 更新锁文件（只有在我们启动了服务器时才更新）
        if (!this.isExternalServer) {
            this.updateLockFile();
        }
        
        console.log(`[Shared Server] 客户端注册完成，当前客户端数: ${this.registeredClients.size}`);
    }

    /**
     * 确保服务器可用（检查现有或启动新的）
     */
    private async ensureServerAvailable(): Promise<void> {
        if (this.isStarted) {
            console.log(`[Shared Server] 服务器已可用`);
            return;
        }

        if (this.isStarting) {
            console.log(`[Shared Server] 服务器正在启动中，等待完成...`);
            // 等待启动完成
            while (this.isStarting) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            return;
        }

        console.log(`[Shared Server] 检查是否存在运行中的共享服务器...`);
        
        try {
            // 首先尝试连接现有服务器
            await this.checkExistingServer();
            this.isExternalServer = true;
            this.isStarted = true;
            console.log(`[Shared Server] 成功连接到现有共享服务器`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`[Shared Server] 未发现现有服务器：${errorMsg}`);
            console.log(`[Shared Server] 启动新的共享服务器...`);
            
            // 启动新的服务器
            await this.startSharedServer();
            this.isExternalServer = false;
        }
    }

    /**
     * 注销客户端
     */
    async unregisterClient(clientId: string): Promise<void> {
        const client = this.registeredClients.get(clientId);
        if (client) {
            console.log(`[Shared Server] 注销客户端: ${client.workspaceName} (${clientId})`);
            this.registeredClients.delete(clientId);
        }

        // 如果没有客户端了，并且是我们启动的服务器，则停止它
        if (this.registeredClients.size === 0 && !this.isExternalServer) {
            console.log(`[Shared Server] 所有客户端已注销，停止服务器`);
            await this.stopSharedServer();
        } else if (!this.isExternalServer) {
            // 更新锁文件（仅当是我们的服务器时）
            this.updateLockFile();
        } else {
            console.log(`[Shared Server] 客户端已注销，但保留外部服务器运行`);
        }
    }

    /**
     * 获取注册的客户端列表
     */
    getRegisteredClients(): ClientRegistration[] {
        return Array.from(this.registeredClients.values());
    }

    /**
     * 根据workspace路径查找客户端
     */
    findClientByWorkspace(workspacePath: string): ClientRegistration | undefined {
        for (const client of this.registeredClients.values()) {
            if (client.workspacePath === workspacePath) {
                return client;
            }
        }
        return undefined;
    }

    /**
     * 获取默认客户端（第一个注册的）
     */
    getDefaultClient(): ClientRegistration | undefined {
        return this.registeredClients.values().next().value;
    }

    /**
     * 检查服务器是否正在运行
     */
    isServerRunning(): boolean {
        if (this.isExternalServer) {
            // 对于外部服务器，只检查状态标志
            return this.isStarted;
        } else {
            // 对于本进程启动的服务器，检查进程状态
            return this.isStarted && !!this.serverProcess && !this.serverProcess.killed;
        }
    }

    /**
     * 获取服务器端口
     */
    getServerPort(): number {
        return getGlobalConfig().port;
    }

    /**
     * 启动共享服务器
     */
    private async startSharedServer(): Promise<void> {
        if (this.isStarting || this.isStarted) {
            return;
        }

        this.isStarting = true;

        try {
            console.log('[Shared Server] 启动共享MCP服务器...');

            // 检查端口是否被占用（如果被占用，此方法会抛出异常或检查现有服务器）
            try {
                await this.checkPortAvailability();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.log(`[Shared Server] 端口检查失败: ${errorMsg}`);
                throw error;
            }

            // 获取扩展路径
            const extensionPath = this.getExtensionPath();
            const serverScriptPath = path.join(extensionPath, 'dist', 'sharedMcpServerProcess.js');

            // 获取当前全局配置
            const globalConfig = getGlobalConfig();
            
            // 启动子进程
            this.serverProcess = spawn('node', [serverScriptPath], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                cwd: extensionPath,
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    SERVER_PORT: globalConfig.port.toString()
                }
            });

            // 设置进程事件监听器
            this.setupServerProcessEventHandlers();

            // 等待服务器启动
            await this.waitForServerReady();

            this.isStarted = true;
            console.log(`[Shared Server] 共享MCP服务器启动成功，端口: ${globalConfig.port}`);
            
            // 通知所有VSCode窗口
            vscode.window.showInformationMessage(`共享MCP服务器已启动，端口: ${globalConfig.port}`);

        } catch (error) {
            console.error('[Shared Server] 启动共享服务器失败:', error);
            await this.cleanup();
            throw error;
        } finally {
            this.isStarting = false;
        }
    }

    /**
     * 停止共享服务器
     */
    private async stopSharedServer(): Promise<void> {
        if (!this.isStarted || !this.serverProcess) {
            return;
        }

        console.log('[Shared Server] 停止共享MCP服务器...');

        try {
            // 优雅停止
            if (!this.serverProcess.killed) {
                this.serverProcess.kill('SIGTERM');
            }

            // 等待进程退出
            await new Promise<void>((resolve) => {
                if (this.serverProcess) {
                    this.serverProcess.on('exit', () => resolve());
                    // 强制超时
                    setTimeout(() => {
                        if (this.serverProcess && !this.serverProcess.killed) {
                            this.serverProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 5000);
                } else {
                    resolve();
                }
            });

            await this.cleanup();
            console.log('[Shared Server] 共享MCP服务器已停止');

        } catch (error) {
            console.error('[Shared Server] 停止共享服务器失败:', error);
            await this.forceCleanup();
        }
    }

    /**
     * 检查端口可用性
     */
    private async checkPortAvailability(): Promise<void> {
        const net = require('net');
        const serverPort = getGlobalConfig().port;
        
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            
            server.listen(serverPort, () => {
                server.close(() => resolve());
            });
            
            server.on('error', (error: any) => {
                if (error.code === 'EADDRINUSE') {
                    // 端口被占用，检查是否是我们自己的服务器
                    this.checkExistingServer()
                        .then(() => {
                            // 是我们的服务器，设置为外部服务器状态
                            this.isExternalServer = true;
                            this.isStarted = true;
                            console.log('[Shared Server] 检测到现有共享服务器，标记为外部服务器');
                            resolve();
                        })
                        .catch((checkError) => {
                            const errorMsg = checkError instanceof Error ? checkError.message : String(checkError);
                            reject(new Error(`端口 ${serverPort} 已被其他进程占用: ${errorMsg}`));
                        });
                } else {
                    reject(error);
                }
            });
        });
    }

    /**
     * 检查现有服务器
     */
    private async checkExistingServer(): Promise<void> {
        console.log('[Shared Server] 开始检查现有服务器...');
        
        const serverPort = getGlobalConfig().port;
        
        // 首先尝试直接连接HTTP端点（更可靠的方法）
        try {
            const http = require('http');
            const options = {
                hostname: 'localhost',
                port: serverPort,
                path: '/health',
                method: 'GET',
                timeout: 3000
            };

            await new Promise<void>((resolve, reject) => {
                const req = http.request(options, (res: any) => {
                    if (res.statusCode === 200) {
                        console.log('[Shared Server] HTTP健康检查通过，发现现有服务器');
                        resolve();
                    } else {
                        reject(new Error(`服务器响应异常: ${res.statusCode}`));
                    }
                });
                
                req.on('error', (err: any) => {
                    console.log(`[Shared Server] HTTP连接失败: ${err.message}`);
                    reject(err);
                });
                req.on('timeout', () => {
                    console.log('[Shared Server] HTTP连接超时');
                    reject(new Error('连接超时'));
                });
                req.end();
            });
            
            console.log('[Shared Server] 通过HTTP检测到现有的共享服务器');
            return;
            
        } catch (httpError) {
            const errorMsg = httpError instanceof Error ? httpError.message : String(httpError);
            console.log(`[Shared Server] HTTP检查失败: ${errorMsg}`);
        }
        
        // HTTP检查失败，尝试检查锁文件
        try {
            if (fs.existsSync(this.lockFilePath)) {
                console.log('[Shared Server] 发现锁文件，检查进程状态...');
                const lockData = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8'));
                
                // 检查进程是否还在运行
                try {
                    process.kill(lockData.pid, 0); // 检查进程是否存在
                    console.log(`[Shared Server] 锁文件进程 ${lockData.pid} 仍在运行，但HTTP不可访问`);
                    
                    // 进程存在但HTTP不可访问，可能服务器正在启动
                    throw new Error('服务器进程存在但不可访问');
                    
                } catch (processError) {
                    // 进程不存在，清理锁文件
                    console.log(`[Shared Server] 锁文件进程已不存在，清理锁文件`);
                    fs.unlinkSync(this.lockFilePath);
                    throw new Error('锁文件进程已不存在');
                }
            } else {
                console.log('[Shared Server] 未找到锁文件');
                throw new Error('未找到锁文件');
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`[Shared Server] 检查现有服务器失败: ${errorMsg}`);
            throw new Error(`检查现有服务器失败: ${errorMsg}`);
        }
    }

    /**
     * 更新锁文件
     */
    private updateLockFile(): void {
        const lockData = {
            pid: process.pid,
            port: getGlobalConfig().port,
            startTime: Date.now(),
            clients: Array.from(this.registeredClients.values()).map(client => ({
                clientId: client.clientId,
                workspaceName: client.workspaceName,
                workspacePath: client.workspacePath
            }))
        };

        try {
            fs.writeFileSync(this.lockFilePath, JSON.stringify(lockData, null, 2));
        } catch (error) {
            console.warn('[Shared Server] 更新锁文件失败:', error);
        }
    }

    /**
     * 获取扩展路径
     */
    private getExtensionPath(): string {
        const currentPath = __dirname;
        if (currentPath.endsWith('dist')) {
            return path.dirname(currentPath);
        }
        return currentPath;
    }

    /**
     * 设置服务器进程事件监听器
     */
    private setupServerProcessEventHandlers(): void {
        if (!this.serverProcess) {
            return;
        }

        this.serverProcess.on('exit', (code, signal) => {
            console.log(`[Shared Server] 服务器进程退出，代码: ${code}，信号: ${signal}`);
            this.isStarted = false;
            this.cleanup();
        });

        this.serverProcess.on('error', (error) => {
            console.error('[Shared Server] 服务器进程错误:', error);
            this.isStarted = false;
            this.cleanup();
        });

        // 监听子进程输出
        this.serverProcess.stdout?.on('data', (data) => {
            console.log(`[Shared Server Process]: ${data.toString()}`);
        });

        this.serverProcess.stderr?.on('data', (data) => {
            console.error(`[Shared Server Process Error]: ${data.toString()}`);
        });
    }

    /**
     * 设置进程事件监听器
     */
    private setupProcessEventHandlers(): void {
        // 监听主进程退出
        process.on('exit', () => {
            this.forceCleanup();
        });

        process.on('SIGINT', () => {
            this.stopSharedServer().catch(console.error);
        });

        process.on('SIGTERM', () => {
            this.stopSharedServer().catch(console.error);
        });
    }

    /**
     * 等待服务器准备就绪
     */
    private async waitForServerReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.serverProcess) {
                reject(new Error('服务器进程未启动'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('等待共享服务器启动超时'));
            }, 15000);

            const onData = (data: Buffer) => {
                const output = data.toString();
                if (output.includes('共享MCP服务器已启动') || output.includes('服务器启动成功')) {
                    clearTimeout(timeout);
                    this.serverProcess?.stdout?.off('data', onData);
                    resolve();
                }
            };

            const onError = (error: Error) => {
                clearTimeout(timeout);
                this.serverProcess?.off('error', onError);
                reject(error);
            };

            this.serverProcess.stdout?.on('data', onData);
            this.serverProcess.on('error', onError);
        });
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        console.log('[Shared Server] 清理资源...');

        this.isStarted = false;
        this.isStarting = false;

        if (this.serverProcess) {
            this.serverProcess.removeAllListeners();
            this.serverProcess = undefined;
        }

        // 清理锁文件
        try {
            if (fs.existsSync(this.lockFilePath)) {
                fs.unlinkSync(this.lockFilePath);
            }
        } catch (error) {
            console.warn('[Shared Server] 清理锁文件失败:', error);
        }
    }

    /**
     * 强制清理资源
     */
    private async forceCleanup(): Promise<void> {
        console.log('[Shared Server] 强制清理资源...');

        if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
        }

        await this.cleanup();
    }
}

// 导出单例实例
export const sharedServerManager = SharedServerManager.getInstance();