import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { mcpIpcClient } from './ipcClient';
import { SourceNavigatorConfig } from './config';
import { mcpServerProcess, ipcClient, setMcpServerProcess, setIpcClient } from './globals';

/**
 * 进程管理器，负责管理MCP服务器进程的生命周期
 */
export class ProcessManager {
    private static instance: ProcessManager;
    private serverProcess: ChildProcess | undefined;
    private isStarting = false;
    private isStopping = false;

    private constructor() {}

    static getInstance(): ProcessManager {
        if (!ProcessManager.instance) {
            ProcessManager.instance = new ProcessManager();
        }
        return ProcessManager.instance;
    }

    /**
     * 启动MCP服务器进程
     */
    async startServerProcess(config: SourceNavigatorConfig): Promise<void> {
        if (this.isStarting) {
            throw new Error('MCP服务器进程正在启动中...');
        }

        if (this.serverProcess && !this.serverProcess.killed) {
            throw new Error('MCP服务器进程已在运行');
        }

        this.isStarting = true;

        try {
            console.log('[Process Manager] 正在启动MCP服务器进程...');

            // 获取扩展路径
            const extensionPath = this.getExtensionPath();
            const serverScriptPath = path.join(extensionPath, 'dist', 'mcpServerProcess.js');

            // 启动子进程
            this.serverProcess = spawn('node', [serverScriptPath], {
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                cwd: extensionPath,
                env: {
                    ...process.env,
                    NODE_ENV: 'production'
                }
            });

            setMcpServerProcess(this.serverProcess);

            // 设置进程事件监听器
            this.setupProcessEventHandlers();

            // 等待进程启动并建立IPC连接
            await this.waitForProcessReady();

            // 连接IPC客户端
            await mcpIpcClient.connect();
            setIpcClient(mcpIpcClient);

            // 初始化MCP服务器
            await mcpIpcClient.initialize(config);

            console.log('[Process Manager] MCP服务器进程启动成功');
            vscode.window.showInformationMessage(`MCP服务器已启动，项目: ${config.projectName}`);

        } catch (error) {
            console.error('[Process Manager] 启动MCP服务器进程失败:', error);
            await this.cleanup();
            throw error;
        } finally {
            this.isStarting = false;
        }
    }

    /**
     * 停止MCP服务器进程
     */
    async stopServerProcess(): Promise<void> {
        if (this.isStopping) {
            return;
        }

        if (!this.serverProcess || this.serverProcess.killed) {
            console.log('[Process Manager] MCP服务器进程未运行或已停止');
            return;
        }

        this.isStopping = true;

        try {
            console.log('[Process Manager] 正在停止MCP服务器进程...');

            // 通过IPC优雅停止
            if (ipcClient && ipcClient.connected) {
                try {
                    await ipcClient.stop();
                } catch (error) {
                    console.warn('[Process Manager] IPC停止请求失败:', error);
                }
                ipcClient.disconnect();
            }

            // 等待进程自然退出
            const exitPromise = new Promise<void>((resolve) => {
                if (this.serverProcess) {
                    this.serverProcess.on('exit', () => resolve());
                } else {
                    resolve();
                }
            });

            // 发送 SIGTERM 信号
            if (this.serverProcess && !this.serverProcess.killed) {
                this.serverProcess.kill('SIGTERM');
            }

            // 等待进程退出，最多等待10秒
            const timeoutPromise = new Promise<void>((resolve) => {
                setTimeout(() => {
                    if (this.serverProcess && !this.serverProcess.killed) {
                        console.warn('[Process Manager] 进程未在指定时间内退出，强制终止');
                        this.serverProcess.kill('SIGKILL');
                    }
                    resolve();
                }, 10000);
            });

            await Promise.race([exitPromise, timeoutPromise]);

            await this.cleanup();
            console.log('[Process Manager] MCP服务器进程已停止');
            vscode.window.showInformationMessage('MCP服务器已停止');

        } catch (error) {
            console.error('[Process Manager] 停止MCP服务器进程失败:', error);
            await this.forceCleanup();
        } finally {
            this.isStopping = false;
        }
    }

    /**
     * 重启MCP服务器进程
     */
    async restartServerProcess(config: SourceNavigatorConfig): Promise<void> {
        console.log('[Process Manager] 正在重启MCP服务器进程...');
        await this.stopServerProcess();
        await this.startServerProcess(config);
    }

    /**
     * 检查进程是否正在运行
     */
    isProcessRunning(): boolean {
        return !!(this.serverProcess && !this.serverProcess.killed);
    }

    /**
     * 获取扩展路径
     */
    private getExtensionPath(): string {
        // 在VSCode扩展环境中，__dirname 通常指向 dist 目录
        // 我们需要获取扩展的根目录
        const currentPath = __dirname;
        if (currentPath.endsWith('dist')) {
            return path.dirname(currentPath);
        }
        return currentPath;
    }

    /**
     * 设置进程事件监听器
     */
    private setupProcessEventHandlers(): void {
        if (!this.serverProcess) return;

        this.serverProcess.on('exit', (code, signal) => {
            console.log(`[Process Manager] MCP服务器进程退出，代码: ${code}，信号: ${signal}`);
            this.cleanup();
        });

        this.serverProcess.on('error', (error) => {
            console.error('[Process Manager] MCP服务器进程错误:', error);
            vscode.window.showErrorMessage(`MCP服务器进程错误: ${error.message}`);
            this.cleanup();
        });

        // 监听子进程的标准输出和错误输出
        this.serverProcess.stdout?.on('data', (data) => {
            console.log(`[MCP Server Process]: ${data.toString()}`);
        });

        this.serverProcess.stderr?.on('data', (data) => {
            console.error(`[MCP Server Process Error]: ${data.toString()}`);
        });
    }

    /**
     * 等待进程准备就绪
     */
    private async waitForProcessReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.serverProcess) {
                reject(new Error('服务器进程未启动'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('等待MCP服务器进程启动超时'));
            }, 15000); // 15秒超时

            // 监听第一次输出，表示进程已启动
            const onData = (data: Buffer) => {
                const output = data.toString();
                if (output.includes('MCP服务器进程已启动') || output.includes('IPC服务器启动')) {
                    clearTimeout(timeout);
                    this.serverProcess?.stdout?.off('data', onData);
                    resolve();
                }
            };

            // 监听错误
            const onError = (error: Error) => {
                clearTimeout(timeout);
                this.serverProcess?.off('error', onError);
                reject(error);
            };

            this.serverProcess.stdout?.on('data', onData);
            this.serverProcess.on('error', onError);

            // 检查进程是否已经退出
            if (this.serverProcess.killed || this.serverProcess.exitCode !== null) {
                clearTimeout(timeout);
                reject(new Error('MCP服务器进程意外退出'));
            }
        });
    }

    /**
     * 清理资源
     */
    private async cleanup(): Promise<void> {
        console.log('[Process Manager] 正在清理资源...');

        // 断开IPC连接
        if (ipcClient) {
            ipcClient.disconnect();
            setIpcClient(undefined);
        }

        // 清理进程引用
        if (this.serverProcess) {
            this.serverProcess.removeAllListeners();
            this.serverProcess = undefined;
            setMcpServerProcess(undefined);
        }
    }

    /**
     * 强制清理资源
     */
    private async forceCleanup(): Promise<void> {
        console.log('[Process Manager] 正在强制清理资源...');

        // 强制终止进程
        if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGKILL');
        }

        await this.cleanup();
    }
}

// 导出单例实例
export const processManager = ProcessManager.getInstance();