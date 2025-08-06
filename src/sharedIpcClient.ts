const { default: ipc } = require('node-ipc');
import { runTool } from './toolRunner';
// 移除不再需要的配置导入

/**
 * 客户端注册信息
 */
export interface ClientRegistration {
    workspacePath: string;
    workspaceName: string;
    clientId: string;
    pid: number;
}

/**
 * 共享IPC客户端类，用于与共享MCP服务器进程通信
 */
export class SharedIpcClient {
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;
    private responseHandlers = new Map<string, { resolve: Function, reject: Function }>();
    private clientRegistration: ClientRegistration | null = null;

    constructor() {
        // 配置IPC客户端
        ipc.config.id = this.generateClientId();
        ipc.config.retry = 1500;
        ipc.config.silent = true;
    }

    /**
     * 生成唯一的客户端ID
     */
    private generateClientId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `mcpClient_${timestamp}_${random}`;
    }

    /**
     * 连接到共享MCP服务器进程
     */
    async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise<void>((resolve, reject) => {
            let connectAttempts = 0;
            const maxAttempts = 3;
            
            const attemptConnection = () => {
                connectAttempts++;
                console.log(`[Shared IPC Client] 尝试连接到共享MCP服务器 (${connectAttempts}/${maxAttempts})...`);
                
                ipc.connectTo('sharedMcpServerProcess', () => {
                    ipc.of.sharedMcpServerProcess.on('connect', () => {
                        console.log('[Shared IPC Client] 已连接到共享MCP服务器进程');
                        this.isConnected = true;
                        this.setupEventHandlers();
                        resolve();
                    });

                    ipc.of.sharedMcpServerProcess.on('disconnect', () => {
                        console.log('[Shared IPC Client] 与共享MCP服务器进程断开连接');
                        this.isConnected = false;
                        this.connectionPromise = null;
                    });

                    ipc.of.sharedMcpServerProcess.on('error', (error: any) => {
                        console.error(`[Shared IPC Client] IPC连接错误 (尝试 ${connectAttempts}):`, error.message);
                        
                        if (connectAttempts < maxAttempts) {
                            console.log(`[Shared IPC Client] ${2}秒后重试连接...`);
                            setTimeout(() => {
                                ipc.disconnect('sharedMcpServerProcess');
                                attemptConnection();
                            }, 2000);
                        } else {
                            this.isConnected = false;
                            this.connectionPromise = null;
                            reject(new Error(`IPC连接失败，已重试 ${maxAttempts} 次: ${error.message}`));
                        }
                    });
                });
                
                // 设置每次尝试的超时
                setTimeout(() => {
                    if (!this.isConnected && connectAttempts === maxAttempts) {
                        this.connectionPromise = null;
                        reject(new Error(`连接共享MCP服务器进程超时，已重试 ${maxAttempts} 次`));
                    } else if (!this.isConnected) {
                        // 触发重试
                        ipc.of.sharedMcpServerProcess.emit('error', new Error('连接超时'));
                    }
                }, 8000); // 每次尝试8秒超时
            };
            
            attemptConnection();
        });

        return this.connectionPromise;
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        // 监听注册响应
        ipc.of.sharedMcpServerProcess.on('register-response', (data: any) => {
            this.handleResponse('register', data);
        });

        // 监听注销响应
        ipc.of.sharedMcpServerProcess.on('unregister-response', (data: any) => {
            this.handleResponse('unregister', data);
        });

        // 监听工具调用请求
        ipc.of.sharedMcpServerProcess.on('tool-call-request', async (data: any) => {
            console.log(`[Shared IPC Client] 收到工具调用请求: ${data.toolName}`);
            try {
                // 执行工具，传入完整的参数
                const result = await runTool(data.toolName, data.args);
                ipc.of.sharedMcpServerProcess.emit('tool-call-response', {
                    requestId: data.requestId,
                    result
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[Shared IPC Client] 工具调用失败: ${data.toolName}`, errorMessage);
                ipc.of.sharedMcpServerProcess.emit('tool-call-response', {
                    requestId: data.requestId,
                    error: errorMessage
                });
            }
        });
    }

    /**
     * 处理响应
     */
    private handleResponse(type: string, data: any): void {
        const handler = this.responseHandlers.get(type);
        if (handler) {
            this.responseHandlers.delete(type);
            if (data.success) {
                handler.resolve(data);
            } else {
                handler.reject(new Error(data.error || `${type}操作失败`));
            }
        }
    }

    /**
     * 注册客户端到共享服务器
     */
    async registerToSharedServer(workspacePath: string, workspaceName: string): Promise<void> {
        if (!this.isConnected) {
            await this.connect();
        }

        this.clientRegistration = {
            workspacePath,
            workspaceName,
            clientId: ipc.config.id,
            pid: process.pid
        };

        return new Promise((resolve, reject) => {
            this.responseHandlers.set('register', { resolve, reject });

            // 设置超时
            setTimeout(() => {
                if (this.responseHandlers.has('register')) {
                    this.responseHandlers.delete('register');
                    reject(new Error('注册到共享服务器超时'));
                }
            }, 15000); // 15秒超时

            ipc.of.sharedMcpServerProcess.emit('register-client', this.clientRegistration);
        });
    }

    /**
     * 从共享服务器注销客户端
     */
    async unregisterFromSharedServer(): Promise<void> {
        if (!this.isConnected || !this.clientRegistration) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.responseHandlers.set('unregister', { resolve, reject });

            // 设置超时
            setTimeout(() => {
                if (this.responseHandlers.has('unregister')) {
                    this.responseHandlers.delete('unregister');
                    reject(new Error('从共享服务器注销超时'));
                }
            }, 10000); // 10秒超时

            ipc.of.sharedMcpServerProcess.emit('unregister-client', {
                clientId: this.clientRegistration!.clientId
            });
        });
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        if (this.isConnected) {
            // 先尝试注销
            if (this.clientRegistration) {
                this.unregisterFromSharedServer().catch(console.error);
            }
            
            ipc.disconnect('sharedMcpServerProcess');
            this.isConnected = false;
            this.connectionPromise = null;
            this.clientRegistration = null;
        }
    }

    /**
     * 检查连接状态
     */
    get connected(): boolean {
        return this.isConnected;
    }

    /**
     * 获取客户端注册信息
     */
    get registration(): ClientRegistration | null {
        return this.clientRegistration;
    }

    /**
     * 获取客户端ID
     */
    get clientId(): string {
        return ipc.config.id;
    }
}

// 导出单例实例
export const sharedIpcClient = new SharedIpcClient();