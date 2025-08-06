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

// 客户端注册信息
interface ClientRegistration {
    workspacePath: string;
    workspaceName: string;
    clientId: string;
    pid: number;
}

// 工具调用请求（支持workspace路由）
interface ToolCallRequest {
    requestId: string;
    toolName: string;
    args: any;
    workspacePath?: string;
}

// 全局变量
let httpServer: HttpServer | undefined;
const registeredClients = new Map<string, ClientRegistration>();
const ipcClients = new Map<string, any>(); // IPC客户端连接映射
const serverPort = parseInt(process.env.SERVER_PORT || '8010');
let shutdownTimer: NodeJS.Timeout | undefined; // 延迟关闭定时器
const shutdownDelay = 30000; // 30秒延迟关闭时间

// 配置IPC服务器
ipc.config.id = 'sharedMcpServerProcess';
ipc.config.retry = 1500;
ipc.config.silent = true;

/**
 * 初始化共享MCP服务器（现在只需要启动HTTP服务器）
 */
async function initializeSharedMcpServer(): Promise<void> {
    console.log('[Shared MCP Server] 初始化共享MCP服务器...');
    
    // 直接启动HTTP服务器，MCP服务器实例在SSE连接时按需创建
    await startHttpServer();
}

/**
 * 路由工具调用到相应的客户端
 */
async function routeToolCallToClient(request: ToolCallRequest): Promise<any> {
    console.log(`[Shared MCP Server] 路由工具调用: ${request.toolName}, workspace: ${request.workspacePath || 'default'}`);
    console.log(`[Shared MCP Server] 工具调用参数:`, request.args);
    
    // 查找目标客户端
    let targetClient: ClientRegistration | undefined;
    
    // 首先尝试从args中提取workspace_path
    const workspacePath = request.workspacePath || request.args?.workspace_path;
    
    if (workspacePath) {
        // 显式指定workspace路径
        console.log(`[Shared MCP Server] 查找workspace路径: ${workspacePath}`);
        targetClient = findClientByWorkspace(workspacePath);
        
        if (!targetClient) {
            console.log(`[Shared MCP Server] 未找到精确匹配的workspace，尝试模糊匹配...`);
            // 尝试模糊匹配
            for (const client of registeredClients.values()) {
                if (client.workspacePath.includes(workspacePath) || workspacePath.includes(client.workspacePath)) {
                    console.log(`[Shared MCP Server] 找到模糊匹配的客户端: ${client.workspaceName}`);
                    targetClient = client;
                    break;
                }
            }
        }
        
        if (!targetClient) {
            console.log(`[Shared MCP Server] 警告: 未找到workspace: ${workspacePath} 对应的客户端，使用默认客户端`);
            targetClient = getDefaultClient();
        }
    } else {
        // 使用默认客户端（第一个注册的）
        console.log(`[Shared MCP Server] 使用默认客户端`);
        targetClient = getDefaultClient();
    }
    
    if (!targetClient) {
        throw new Error('没有可用的客户端处理工具调用');
    }
    
    console.log(`[Shared MCP Server] 将工具调用路由到客户端: ${targetClient.workspaceName} (${targetClient.clientId})`);
    
    // 通过IPC发送工具调用请求
    return await sendToolCallToClient(targetClient.clientId, request);
}

/**
 * 查找指定workspace的客户端
 */
function findClientByWorkspace(workspacePath: string): ClientRegistration | undefined {
    for (const client of registeredClients.values()) {
        if (client.workspacePath === workspacePath) {
            return client;
        }
    }
    return undefined;
}

/**
 * 获取默认客户端
 */
function getDefaultClient(): ClientRegistration | undefined {
    return registeredClients.values().next().value;
}

/**
 * 通过IPC发送工具调用请求给指定客户端
 */
function sendToolCallToClient(clientId: string, request: ToolCallRequest): Promise<any> {
    return new Promise((resolve, reject) => {
        const requestId = request.requestId;
        
        // 设置超时
        const timeout = setTimeout(() => {
            reject(new Error(`工具调用超时: ${request.toolName} (客户端: ${clientId})`));
        }, 30000); // 30秒超时
        
        // 监听响应
        const responseHandler = (data: any, socket: any) => {
            if (data.requestId === requestId && socket.id === clientId) {
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
        
        // 向特定客户端发送请求
        const clientSocket = ipcClients.get(clientId);
        if (clientSocket) {
            ipc.server.emit(clientSocket, 'tool-call-request', request);
        } else {
            clearTimeout(timeout);
            reject(new Error(`客户端连接不存在: ${clientId}`));
        }
    });
}

/**
 * 启动HTTP服务器
 */
async function startHttpServer(): Promise<void> {

    const app = express();
    app.use(cors());
    app.use(express.json());

    // 跟踪活动的传输连接 - 修复：使用Map来更好地管理连接
    const transports = new Map<string, SSEServerTransport>();
    const transportServers = new Map<string, Server>(); // 为每个连接创建独立的服务器实例

    // SSE端点
    app.get('/sse', async (req: Request, res: Response) => {
        console.log(`[Shared MCP Server] 新的SSE连接请求`);
        
        req.socket.setTimeout(0);
        req.socket.setNoDelay(true);
        req.socket.setKeepAlive(true);
        
        try {
            const transport = new SSEServerTransport('/message', res);
            const sessionId = transport.sessionId;
            
            // 为这个会话创建独立的MCP服务器实例
            const sessionServer = new Server(
                {
                    name: "shared-source-navigator",
                    version: "0.1.0",
                    description: "共享的源码导航MCP服务器，支持多窗口工作区"
                },
                {
                    capabilities: {
                        tools: {},
                        resources: {},
                    }
                }
            );

            // 为会话服务器设置处理器
            sessionServer.setRequestHandler(ListToolsRequestSchema, async () => ({
                tools: mcpTools
            }));

            sessionServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
                resources: []
            }));

            sessionServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
                templates: []
            }));

            // 设置工具调用处理器 - 支持workspace路由
            sessionServer.setRequestHandler(CallToolRequestSchema, async (request) => {
                try {
                    const { name, arguments: args } = request.params;
                    
                    console.log(`[Shared MCP Server] 处理工具调用: ${name} (会话: ${sessionId})`);
                    
                    // 提取workspace路径用于路由
                    const workspacePath = args?.workspace_path;
                    
                    // 路由到相应的客户端
                    const result = await routeToolCallToClient({
                        requestId: `${sessionId}-${Date.now()}`, // 添加会话ID前缀
                        toolName: name,
                        args: args || {},
                        workspacePath: workspacePath as string | undefined
                    });
                    
                    return { content: [{ type: "text", text: JSON.stringify(result) }] };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`[Shared MCP Server] 工具调用错误 (会话: ${sessionId}):`, errorMessage);
                    return {
                        content: [{ type: "text", text: `Error: ${errorMessage}` }],
                        isError: true,
                    };
                }
            });

            // 存储传输连接和对应的服务器
            transports.set(sessionId, transport);
            transportServers.set(sessionId, sessionServer);

            const keepAliveInterval = setInterval(() => {
                if (res.writable) {
                    res.write(': keepalive\n\n');
                }
            }, 30000);

            // 连接会话专用的服务器到传输
            await sessionServer.connect(transport);
            console.log(`[Shared MCP Server] 独立服务器连接到SSE传输，会话ID: ${sessionId}`);
            
            req.on('close', () => {
                console.log(`[Shared MCP Server] SSE连接关闭，会话: ${sessionId}`);
                clearInterval(keepAliveInterval);
                
                // 清理会话相关资源
                const sessionTransport = transports.get(sessionId);
                const sessionServer = transportServers.get(sessionId);
                
                if (sessionTransport) {
                    sessionTransport.close().catch(err => {
                        console.error('[Shared MCP Server] 关闭传输时出错:', err);
                    });
                    transports.delete(sessionId);
                }
                
                if (sessionServer) {
                    sessionServer.close();
                    transportServers.delete(sessionId);
                }
                
                console.log(`[Shared MCP Server] 会话资源已清理: ${sessionId}`);
            });
        } catch (error) {
            console.error('[Shared MCP Server] SSE连接出错:', error);
            res.status(500).end();
        }
    });
    
    // 消息端点 - 修复：使用Map获取传输连接
    app.post('/message', async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        console.log(`[Shared MCP Server] 收到消息，会话: ${sessionId}，方法:`, req.body?.method);
        
        const transport = transports.get(sessionId);
        if (!transport) {
            console.error(`[Shared MCP Server] 未找到会话: ${sessionId}`);
            console.error(`[Shared MCP Server] 当前活动会话: ${Array.from(transports.keys()).join(', ')}`);
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
            console.log(`[Shared MCP Server] 消息处理成功，会话: ${sessionId}`);
        } catch (error) {
            console.error(`[Shared MCP Server] 消息处理出错，会话: ${sessionId}:`, error);
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
    
    // 健康检查端点
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({ 
            status: 'ok',
            server: 'shared-source-navigator',
            clients: Array.from(registeredClients.values()).map(client => ({
                clientId: client.clientId,
                workspaceName: client.workspaceName,
                workspacePath: client.workspacePath
            })),
            activeSessions: Array.from(transports.keys()),
            sessionCount: transports.size,
            port: serverPort
        });
    });

    // 客户端状态端点
    app.get('/clients', (req: Request, res: Response) => {
        res.status(200).json({
            clients: Array.from(registeredClients.values()),
            totalClients: registeredClients.size
        });
    });

    try {
        const server = app.listen(serverPort);
        httpServer = server;
        console.log(`[Shared MCP Server] 共享MCP服务器启动成功，监听端口: ${serverPort}`);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`启动HTTP服务器失败，端口: ${serverPort}。错误: ${errorMsg}`);
    }
}

/**
 * 计划延迟关闭
 */
function scheduleDelayedShutdown(): void {
    // 取消之前的定时器
    if (shutdownTimer) {
        clearTimeout(shutdownTimer);
    }

    // 设置新的延迟关闭定时器
    shutdownTimer = setTimeout(async () => {
        // 再次检查是否还有客户端（防止在延迟期间有新客户端连接）
        if (registeredClients.size === 0) {
            console.log('[Shared MCP Server] 延迟关闭时间到，停止服务器');
            await stopServer();
            process.exit(0);
        } else {
            console.log('[Shared MCP Server] 延迟关闭期间有新客户端连接，取消关闭');
        }
        shutdownTimer = undefined;
    }, shutdownDelay);

    console.log(`[Shared MCP Server] 已设置延迟关闭定时器，${shutdownDelay / 1000}秒后执行`);
}

/**
 * 取消延迟关闭
 */
function cancelDelayedShutdown(): void {
    if (shutdownTimer) {
        console.log('[Shared MCP Server] 取消延迟关闭定时器');
        clearTimeout(shutdownTimer);
        shutdownTimer = undefined;
    }
}

/**
 * 停止服务器
 */
async function stopServer(): Promise<void> {
    console.log('[Shared MCP Server] 正在停止服务器...');
    
    // 取消延迟关闭定时器
    cancelDelayedShutdown();
    
    // 在startHttpServer作用域内定义的变量无法在这里访问
    // 我们通过关闭HTTP服务器来间接清理所有SSE连接
    if (httpServer) {
        httpServer.close();
        httpServer = undefined;
    }
    
    // 清理客户端连接
    registeredClients.clear();
    ipcClients.clear();
    
    console.log('[Shared MCP Server] 服务器已停止');
}

// IPC服务器设置
ipc.serve(() => {
    console.log('[Shared MCP Server] IPC服务器启动');
    
    // 监听客户端注册
    ipc.server.on('register-client', (data: ClientRegistration, socket: any) => {
        try {
            console.log(`[Shared MCP Server] 客户端注册: ${data.workspaceName} (${data.clientId})`);
            
            registeredClients.set(data.clientId, data);
            ipcClients.set(data.clientId, socket);
            
            // 存储socket的客户端ID，用于后续识别
            socket.id = data.clientId;
            
            // 取消延迟关闭定时器（有新客户端连接）
            if (shutdownTimer) {
                console.log('[Shared MCP Server] 有新客户端连接，取消延迟关闭');
                cancelDelayedShutdown();
            }
            
            ipc.server.emit(socket, 'register-response', { success: true });
            
            // 更新锁文件中的客户端信息
            updateLockFileClients();
            
            console.log(`[Shared MCP Server] 客户端注册成功，当前客户端数: ${registeredClients.size}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[Shared MCP Server] 客户端注册失败:', errorMsg);
            ipc.server.emit(socket, 'register-response', { success: false, error: errorMsg });
        }
    });
    
    // 监听客户端注销
    ipc.server.on('unregister-client', (data: { clientId: string }, socket: any) => {
        try {
            console.log(`[Shared MCP Server] 客户端注销: ${data.clientId}`);
            
            const client = registeredClients.get(data.clientId);
            if (client) {
                registeredClients.delete(data.clientId);
                ipcClients.delete(data.clientId);
                console.log(`[Shared MCP Server] 客户端注销成功: ${client.workspaceName}`);
            }
            
            ipc.server.emit(socket, 'unregister-response', { success: true });
            
            // 更新锁文件中的客户端信息
            updateLockFileClients();
            
            // 如果没有客户端了，启动延迟关闭
            if (registeredClients.size === 0) {
                console.log(`[Shared MCP Server] 所有客户端已断开，将在${shutdownDelay / 1000}秒后关闭服务器`);
                scheduleDelayedShutdown();
            }
            
            console.log(`[Shared MCP Server] 当前客户端数: ${registeredClients.size}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[Shared MCP Server] 客户端注销失败:', errorMsg);
            ipc.server.emit(socket, 'unregister-response', { success: false, error: errorMsg });
        }
    });

    // 监听测试工具调用（用于测试路由功能）
    ipc.server.on('test-tool-call', async (request: ToolCallRequest, socket: any) => {
        try {
            console.log(`[Shared MCP Server] 收到测试工具调用: ${request.toolName}`);
            console.log(`[Shared MCP Server] 请求参数:`, request.args);
            
            // 路由到相应的客户端
            const result = await routeToolCallToClient(request);
            
            // 发送响应给测试客户端
            ipc.server.emit(socket, 'test-tool-response', {
                requestId: request.requestId,
                result
            });
            
            console.log(`[Shared MCP Server] 测试工具调用完成: ${request.requestId}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[Shared MCP Server] 测试工具调用失败:', errorMsg);
            
            ipc.server.emit(socket, 'test-tool-response', {
                requestId: request.requestId,
                error: errorMsg
            });
        }
    });
    
    // 监听客户端断开连接
    ipc.server.on('socket.disconnected', (socket: any, destroyedSocketID: string) => {
        console.log(`[Shared MCP Server] 客户端连接断开: ${destroyedSocketID}`);
        
        // 查找并移除断开的客户端
        for (const [clientId, clientSocket] of ipcClients.entries()) {
            if (clientSocket === socket || (socket.id && socket.id === clientId)) {
                const client = registeredClients.get(clientId);
                if (client) {
                    console.log(`[Shared MCP Server] 清理断开的客户端: ${client.workspaceName} (${clientId})`);
                    registeredClients.delete(clientId);
                }
                ipcClients.delete(clientId);
                break;
            }
        }
        
        // 更新锁文件中的客户端信息
        updateLockFileClients();
        
        console.log(`[Shared MCP Server] 当前客户端数: ${registeredClients.size}`);
        
        // 如果没有客户端了，启动延迟关闭
        if (registeredClients.size === 0) {
            console.log(`[Shared MCP Server] 所有客户端已断开，将在${shutdownDelay / 1000}秒后关闭服务器`);
            scheduleDelayedShutdown();
        }
    });
});

/**
 * 检查是否已有服务器在运行
 */
async function checkExistingServer(): Promise<boolean> {
    try {
        const http = require('http');
        const options = {
            hostname: 'localhost',
            port: serverPort,
            path: '/health',
            method: 'GET',
            timeout: 2000
        };

        await new Promise<void>((resolve, reject) => {
            const req = http.request(options, (res: any) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    reject(new Error('服务器响应异常'));
                }
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('连接超时')));
            req.end();
        });
        
        return true; // 服务器已存在且正常
    } catch (error) {
        return false; // 没有现有服务器
    }
}

/**
 * 创建服务器锁文件
 */
function createServerLockFile(): void {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    const lockFilePath = path.join(os.tmpdir(), 'source-navigator-server.lock');
    const lockData = {
        serverPid: process.pid,
        port: serverPort,
        startTime: Date.now(),
        serverType: 'shared-mcp-server',
        isDetached: true,
        clients: [] // 初始为空，通过IPC更新
    };

    try {
        fs.writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2));
        console.log(`[Shared MCP Server] 创建锁文件: ${lockFilePath}, PID: ${process.pid}`);
    } catch (error) {
        console.warn('[Shared MCP Server] 创建锁文件失败:', error);
    }
}

/**
 * 更新锁文件中的客户端信息
 */
function updateLockFileClients(): void {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    const lockFilePath = path.join(os.tmpdir(), 'source-navigator-server.lock');
    
    try {
        if (fs.existsSync(lockFilePath)) {
            const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
            lockData.clients = Array.from(registeredClients.values()).map(client => ({
                clientId: client.clientId,
                workspaceName: client.workspaceName,
                workspacePath: client.workspacePath,
                pid: client.pid
            }));
            lockData.lastUpdate = Date.now();
            
            fs.writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2));
            console.log(`[Shared MCP Server] 锁文件已更新，客户端数: ${lockData.clients.length}`);
        }
    } catch (error) {
        console.warn('[Shared MCP Server] 更新锁文件失败:', error);
    }
}

/**
 * 清理服务器锁文件
 */
function cleanupServerLockFile(): void {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    const lockFilePath = path.join(os.tmpdir(), 'source-navigator-server.lock');
    
    try {
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
            console.log('[Shared MCP Server] 已清理锁文件');
        }
    } catch (error) {
        console.warn('[Shared MCP Server] 清理锁文件失败:', error);
    }
}

/**
 * 主启动函数
 */
async function startServer() {
    console.log('[Shared MCP Server] 检查现有服务器...');
    
    const existingServer = await checkExistingServer();
    if (existingServer) {
        console.log('[Shared MCP Server] 检测到现有服务器正在运行，本进程退出');
        console.log('[Shared MCP Server] 💡 提示: 新的VSCode窗口应该连接到现有的共享服务器');
        process.exit(0); // 优雅退出，让客户端连接到现有服务器
    }
    
    console.log('[Shared MCP Server] 未检测到现有服务器，启动新的服务器实例');
    
    // 创建锁文件
    createServerLockFile();
    
    // 启动IPC服务器
    ipc.server.start();

    // 初始化MCP服务器
    await initializeSharedMcpServer();
    console.log('[Shared MCP Server] 服务器启动成功');
}

// 启动服务器
startServer().catch((error) => {
    console.error('[Shared MCP Server] 服务器启动失败:', error);
    process.exit(1);
});

// 处理进程退出
process.on('SIGINT', async () => {
    console.log('[Shared MCP Server] 收到SIGINT信号，正在关闭...');
    cancelDelayedShutdown();
    cleanupServerLockFile();
    await stopServer();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Shared MCP Server] 收到SIGTERM信号，正在关闭...');
    cancelDelayedShutdown();
    cleanupServerLockFile();
    await stopServer();
    process.exit(0);
});

process.on('exit', () => {
    cancelDelayedShutdown();
    cleanupServerLockFile();
});

console.log('[Shared MCP Server] 共享MCP服务器进程已启动');