import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
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

    private constructor() {
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
            // 尝试连接现有服务器（仅通过HTTP健康检查）
            await this.checkServerHealth(getGlobalConfig().port);
            this.isExternalServer = true;
            this.isStarted = true;
            console.log(`[Shared Server] 成功连接到现有共享服务器`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.log(`[Shared Server] 未发现现有服务器：${errorMsg}`);
            console.log(`[Shared Server] 启动新的独立服务器...`);
            
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

        // 对于独立进程，我们不主动停止服务器
        // 服务器进程会通过IPC检测客户端连接状态，并在适当时候自动退出
        console.log(`[Shared Server] 客户端已注销，当前客户端数: ${this.registeredClients.size}`);
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
     * 检查服务器是否正在运行（通过HTTP健康检查）
     */
    async isServerRunning(): Promise<boolean> {
        if (!this.isStarted) {
            return false;
        }

        try {
            // 使用HTTP健康检查来验证服务器实际状态
            await this.checkServerHealth(getGlobalConfig().port);
            return true;
        } catch (error) {
            // 如果健康检查失败，更新状态
            console.log('[Shared Server] 服务器健康检查失败，更新状态为未运行');
            this.isStarted = false;
            return false;
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
            console.log('[Shared Server] 启动独立MCP服务器进程...');

            // 获取扩展路径
            const extensionPath = this.getExtensionPath();
            const serverScriptPath = path.join(extensionPath, 'dist', 'sharedMcpServerProcess.js');

            // 获取当前全局配置
            const globalConfig = getGlobalConfig();
            
            // 启动独立的子进程
            this.serverProcess = spawn('node', [serverScriptPath], {
                detached: true,           // 创建独立的进程组
                stdio: ['ignore', 'ignore', 'ignore'], // 不使用标准输入输出
                cwd: extensionPath,
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    SERVER_PORT: globalConfig.port.toString()
                }
            });
            
            // 取消对子进程的引用，让它独立运行
            this.serverProcess.unref();

            // 设置进程事件监听器
            this.setupServerProcessEventHandlers();

            // 等待服务器启动
            await this.waitForServerReady();

            this.isStarted = true;
            
            console.log(`[Shared Server] 独立MCP服务器启动成功，端口: ${globalConfig.port}`);
            
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
     * 停止共享服务器（注意：独立进程通常不需要手动停止）
     */
    private async stopSharedServer(): Promise<void> {
        if (!this.isStarted) {
            return;
        }

        console.log('[Shared Server] 请求停止独立MCP服务器...');

        try {
            // 对于独立进程，我们主要是清理本地状态
            // 服务器进程会在没有客户端连接时自动退出
            await this.cleanup();
            console.log('[Shared Server] 本地状态已清理，独立服务器将继续运行');

        } catch (error) {
            console.error('[Shared Server] 清理本地状态失败:', error);
            await this.forceCleanup();
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
     * 设置服务器进程事件监听器（独立进程模式下最小化监听）
     */
    private setupServerProcessEventHandlers(): void {
        if (!this.serverProcess) {
            return;
        }

        // 只监听启动错误，不监听exit事件（因为独立进程退出是正常的）
        this.serverProcess.on('error', (error) => {
            console.error('[Shared Server] 服务器进程启动错误:', error);
            this.isStarted = false;
            this.cleanup();
        });

        // 注意：
        // 1. 不监听 'exit' 事件，因为独立进程的退出不应该影响管理器状态
        // 2. 服务器状态通过HTTP健康检查来验证
        // 3. 进程通过detached + unref完全独立运行
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
     * 等待服务器准备就绪（通过HTTP健康检查）
     */
    private async waitForServerReady(): Promise<void> {
        const serverPort = getGlobalConfig().port;
        const maxAttempts = 30; // 最多尝试30次
        const delayMs = 500;    // 每次间隔500ms
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`[Shared Server] 检查服务器状态 (${attempt}/${maxAttempts})...`);
                
                // 使用HTTP健康检查
                await this.checkServerHealth(serverPort);
                
                console.log(`[Shared Server] 服务器启动成功，响应正常`);
                return;
                
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw new Error(`等待服务器启动超时，尝试了${maxAttempts}次`);
                }
                
                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    
    /**
     * 检查服务器健康状态
     */
    private async checkServerHealth(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const http = require('http');
            const options = {
                hostname: 'localhost',
                port: port,
                path: '/health',
                method: 'GET',
                timeout: 2000
            };

            const req = http.request(options, (res: any) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error(`服务器响应异常: ${res.statusCode}`));
                }
            });
            
            req.on('error', (err: any) => {
                reject(err);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('健康检查超时'));
            });
            
            req.end();
        });
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        console.log('[Shared Server] 清理本地资源...');

        this.isStarted = false;
        this.isStarting = false;

        if (this.serverProcess) {
            this.serverProcess.removeAllListeners();
            this.serverProcess = undefined;
        }
    }

    /**
     * 强制清理资源（独立进程不需要强制终止）
     */
    private async forceCleanup(): Promise<void> {
        console.log('[Shared Server] 强制清理本地资源...');

        // 对于独立进程，我们只清理本地状态，不强制终止服务器
        // 服务器进程会在适当的时候自然退出
        await this.cleanup();
    }
}

// 导出单例实例
export const sharedServerManager = SharedServerManager.getInstance();