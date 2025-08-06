import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
    CallToolRequestSchema, 
    ListResourcesRequestSchema, 
    ListResourceTemplatesRequestSchema, 
    ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import type { Server as HttpServer } from 'http';
import { Request, Response } from 'express';
const { default: ipc } = require('node-ipc');
import { mcpTools } from './tools';

// 配置接口
interface SourceNavigatorConfig {
    projectName: string;
    description: string;
    path: string;
    port: number;
}

// 全局变量
let mcpServer: Server | undefined;
let httpServer: HttpServer | undefined;
let config: SourceNavigatorConfig | undefined;

// 配置IPC
ipc.config.id = 'mcpServerProcess';
ipc.config.retry = 1500;
ipc.config.silent = true;

/**
 * 初始化MCP服务器
 */
async function initializeMcpServer(serverConfig: SourceNavigatorConfig): Promise<void> {
    config = serverConfig;
    
    // 创建MCP服务器实例
    mcpServer = new Server(
        {
            name: config.projectName,
            version: "0.1.0",
            description: config.description
        },
        {
            capabilities: {
                tools: {},
                resources: {},
            }
        }
    );

    // 设置工具处理器
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: mcpTools
    }));

    mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: []
    }));

    mcpServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
        templates: []
    }));

    // 设置工具调用处理器 - 通过IPC代理给插件执行
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            const { name, arguments: args } = request.params;
            
            console.log(`[MCP Server Process] 处理工具调用: ${name}`);
            
            // 通过IPC发送工具调用请求给插件
            const result = await sendToolCallToPlugin(name, args);
            
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[MCP Server Process] 工具调用错误:`, errorMessage);
            return {
                content: [{ type: "text", text: `Error: ${errorMessage}` }],
                isError: true,
            };
        }
    });

    // 启动HTTP服务器
    await startHttpServer();
}

/**
 * 通过IPC发送工具调用请求给插件
 */
function sendToolCallToPlugin(toolName: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const requestId = Date.now().toString();
        
        // 设置超时
        const timeout = setTimeout(() => {
            reject(new Error(`工具调用超时: ${toolName}`));
        }, 30000); // 30秒超时
        
        // 监听响应
        const responseHandler = (data: any) => {
            if (data.requestId === requestId) {
                clearTimeout(timeout);
                ipc.server.off('tool-call-response', responseHandler);
                
                if (data.error) {
                    reject(new Error(data.error));
                } else {
                    resolve(data.result);
                }
            }
        };
        
        ipc.server.on('tool-call-response', responseHandler);
        
        // 发送请求
        ipc.server.broadcast('tool-call-request', {
            requestId,
            toolName,
            args
        });
    });
}

/**
 * 启动HTTP服务器
 */
async function startHttpServer(): Promise<void> {
    if (!config || !mcpServer) {
        throw new Error('服务器配置或MCP服务器未初始化');
    }

    const app = express();
    app.use(cors());
    app.use(express.json());

    // 跟踪活动的传输连接
    const transports: { [sessionId: string]: SSEServerTransport } = {};

    const basePath = getProjectBasePath(config);

    // 创建项目特定的SSE端点
    app.get(`${basePath}/sse`, async (req: Request, res: Response) => {
        console.log(`[MCP Server Process] 新的SSE连接请求，项目: ${config!.projectName}`);
        
        req.socket.setTimeout(0);
        req.socket.setNoDelay(true);
        req.socket.setKeepAlive(true);
        
        try {
            // 使用项目特定的消息端点路径创建传输
            const transport = new SSEServerTransport(`${basePath}/message`, res);
            const sessionId = transport.sessionId;
            transports[sessionId] = transport;

            const keepAliveInterval = setInterval(() => {
                if (res.writable) {
                    res.write(': keepalive\n\n');
                }
            }, 30000);

            if (mcpServer) {
                await mcpServer.connect(transport);
                console.log(`[MCP Server Process] 服务器连接到SSE传输，会话ID: ${sessionId}，项目: ${config!.projectName}`);
                
                req.on('close', () => {
                    console.log(`[MCP Server Process] SSE连接关闭，会话: ${sessionId}`);
                    clearInterval(keepAliveInterval);
                    delete transports[sessionId];
                    transport.close().catch(err => {
                        console.error('[MCP Server Process] 关闭传输时出错:', err);
                    });
                });
            } else {
                console.error('[MCP Server Process] MCP服务器未初始化');
                res.status(500).end();
                return;
            }
        } catch (error) {
            console.error('[MCP Server Process] SSE连接出错:', error);
            res.status(500).end();
        }
    });
    
    // 创建项目特定的消息端点
    app.post(`${basePath}/message`, async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        console.log(`[MCP Server Process] 收到消息，会话: ${sessionId}，项目: ${config!.projectName}，方法:`, req.body?.method);
        
        const transport = transports[sessionId];
        if (!transport) {
            console.error(`[MCP Server Process] 未找到会话: ${sessionId}`);
            res.status(400).json({
                jsonrpc: "2.0",
                id: req.body?.id,
                error: {
                    code: -32000,
                    message: "未找到活动会话"
                }
            });
            return;
        }
        
        try {
            await transport.handlePostMessage(req, res, req.body);
            console.log('[MCP Server Process] 消息处理成功');
        } catch (error) {
            console.error('[MCP Server Process] 消息处理出错:', error);
            res.status(500).json({
                jsonrpc: "2.0",
                id: req.body?.id,
                error: {
                    code: -32000,
                    message: String(error)
                }
            });
        }
    });
    
    // 添加项目特定的健康检查端点
    app.get(`${basePath}/health`, (req: Request, res: Response) => {
        res.status(200).json({ 
            status: 'ok',
            project: config!.projectName,
            description: config!.description
        });
    });

    try {
        const server = app.listen(config.port);
        httpServer = server;
        console.log(`[MCP Server Process] MCP服务器启动成功，项目: ${config.projectName}，监听: http://localhost:${config.port}${basePath}`);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`启动服务器失败，端口: ${config.port}${basePath}。请检查端口是否可用或配置不同端口。错误: ${errorMsg}`);
    }
}

/**
 * 获取项目基础路径
 */
function getProjectBasePath(config: SourceNavigatorConfig): string {
    // 为了向后兼容，如果路径为空，返回空字符串（根路径）
    if (!config.path) {
        return '';
    }
    if (!config.path.startsWith('/')) {
        config.path = '/' + config.path;
    }
    return `${config.path}`;
}

/**
 * 停止服务器
 */
async function stopServer(): Promise<void> {
    console.log('[MCP Server Process] 正在停止服务器...');
    
    if (mcpServer) {
        mcpServer.close();
        mcpServer = undefined;
    }
    
    if (httpServer) {
        httpServer.close();
        httpServer = undefined;
    }
    
    console.log('[MCP Server Process] 服务器已停止');
}

// IPC服务器设置
ipc.serve(() => {
    console.log('[MCP Server Process] IPC服务器启动');
    
    // 监听来自插件的初始化请求
    ipc.server.on('initialize', async (data: SourceNavigatorConfig, socket: any) => {
        try {
            console.log('[MCP Server Process] 收到初始化请求:', data.projectName);
            await initializeMcpServer(data);
            ipc.server.emit(socket, 'initialize-response', { success: true });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[MCP Server Process] 初始化失败:', errorMsg);
            ipc.server.emit(socket, 'initialize-response', { success: false, error: errorMsg });
        }
    });
    
    // 监听停止请求
    ipc.server.on('stop', async (data: any, socket: any) => {
        try {
            console.log('[MCP Server Process] 收到停止请求');
            await stopServer();
            ipc.server.emit(socket, 'stop-response', { success: true });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[MCP Server Process] 停止失败:', errorMsg);
            ipc.server.emit(socket, 'stop-response', { success: false, error: errorMsg });
        }
    });
    
    // 监听客户端断开连接
    ipc.server.on('socket.disconnected', () => {
        console.log('[MCP Server Process] 插件客户端断开连接，正在停止服务器');
        stopServer().catch(console.error);
    });
});

// 启动IPC服务器
ipc.server.start();

// 处理进程退出
process.on('SIGINT', async () => {
    console.log('[MCP Server Process] 收到SIGINT信号，正在关闭...');
    await stopServer();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[MCP Server Process] 收到SIGTERM信号，正在关闭...');
    await stopServer();
    process.exit(0);
});

console.log('[MCP Server Process] MCP服务器进程已启动');