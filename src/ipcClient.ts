const { default: ipc } = require('node-ipc');
import { runTool } from './toolRunner';
import { SourceNavigatorConfig } from './config';

/**
 * IPC客户端类，用于与MCP服务器进程通信
 */
export class McpIpcClient {
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;
    private responseHandlers = new Map<string, { resolve: Function, reject: Function }>();

    constructor() {
        // 配置IPC客户端
        ipc.config.id = 'mcpExtensionClient';
        ipc.config.retry = 1500;
        ipc.config.silent = true;
    }

    /**
     * 连接到MCP服务器进程
     */
    async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise<void>((resolve, reject) => {
            ipc.connectTo('mcpServerProcess', () => {
                ipc.of.mcpServerProcess.on('connect', () => {
                    console.log('[IPC Client] 已连接到MCP服务器进程');
                    this.isConnected = true;
                    this.setupEventHandlers();
                    resolve();
                });

                ipc.of.mcpServerProcess.on('disconnect', () => {
                    console.log('[IPC Client] 与MCP服务器进程断开连接');
                    this.isConnected = false;
                    this.connectionPromise = null;
                });

                ipc.of.mcpServerProcess.on('error', (error: any) => {
                    console.error('[IPC Client] IPC连接错误:', error);
                    this.isConnected = false;
                    this.connectionPromise = null;
                    reject(error);
                });

                // 设置连接超时
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('连接MCP服务器进程超时'));
                    }
                }, 10000); // 10秒超时
            });
        });

        return this.connectionPromise;
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        // 监听初始化响应
        ipc.of.mcpServerProcess.on('initialize-response', (data: any) => {
            this.handleResponse('initialize', data);
        });

        // 监听停止响应
        ipc.of.mcpServerProcess.on('stop-response', (data: any) => {
            this.handleResponse('stop', data);
        });

        // 监听工具调用请求
        ipc.of.mcpServerProcess.on('tool-call-request', async (data: any) => {
            console.log(`[IPC Client] 收到工具调用请求: ${data.toolName}`);
            try {
                const result = await runTool(data.toolName, data.args);
                ipc.of.mcpServerProcess.emit('tool-call-response', {
                    requestId: data.requestId,
                    result
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`[IPC Client] 工具调用失败: ${data.toolName}`, errorMessage);
                ipc.of.mcpServerProcess.emit('tool-call-response', {
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
     * 初始化MCP服务器
     */
    async initialize(config: SourceNavigatorConfig): Promise<void> {
        if (!this.isConnected) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            this.responseHandlers.set('initialize', { resolve, reject });

            // 设置超时
            setTimeout(() => {
                if (this.responseHandlers.has('initialize')) {
                    this.responseHandlers.delete('initialize');
                    reject(new Error('初始化MCP服务器超时'));
                }
            }, 30000); // 30秒超时

            ipc.of.mcpServerProcess.emit('initialize', config);
        });
    }

    /**
     * 停止MCP服务器
     */
    async stop(): Promise<void> {
        if (!this.isConnected) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.responseHandlers.set('stop', { resolve, reject });

            // 设置超时
            setTimeout(() => {
                if (this.responseHandlers.has('stop')) {
                    this.responseHandlers.delete('stop');
                    reject(new Error('停止MCP服务器超时'));
                }
            }, 15000); // 15秒超时

            ipc.of.mcpServerProcess.emit('stop', {});
        });
    }

    /**
     * 断开连接
     */
    disconnect(): void {
        if (this.isConnected) {
            ipc.disconnect('mcpServerProcess');
            this.isConnected = false;
            this.connectionPromise = null;
        }
    }

    /**
     * 检查连接状态
     */
    get connected(): boolean {
        return this.isConnected;
    }
}

// 导出单例实例
export const mcpIpcClient = new McpIpcClient();