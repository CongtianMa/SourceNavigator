import * as vscode from 'vscode';
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
import { mcpTools } from './tools';
import { createDebugPanel } from './debugPanel';
import { setMcpServer, setHttpServer } from './globals';
import { runTool } from './toolRunner';
import { findSourceNavigatorConfig, SourceNavigatorConfig, getProjectBasePath } from './config';

export async function activate(context: vscode.ExtensionContext) {
    let currentConfig: SourceNavigatorConfig | null = null;

    // 处理工作区文件夹变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            await restartServerWithConfig();
        })
    );

    // 初始服务器启动
    await restartServerWithConfig();

    // 注册调试面板命令
    context.subscriptions.push(
        vscode.commands.registerCommand('source-navigator.openDebugPanel', () => {
            createDebugPanel(context);
        })
    );

    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('source-navigator.startServer', async () => {
            try {
                const httpServer = getHttpServer();
                if (httpServer) {
                    vscode.window.showInformationMessage(`MCP 服务器已在项目 ${currentConfig?.projectName || 'unknown'} 上运行`);
                    return;
                }
                await restartServerWithConfig();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`启动 MCP 服务器失败: ${errorMsg}`);
            }
        }),
        vscode.commands.registerCommand('source-navigator.stopServer', async () => {
            const mcpServer = getMcpServer();
            const httpServer = getHttpServer();
            
            if (!httpServer && !mcpServer) {
                vscode.window.showInformationMessage('当前没有 MCP 服务器在运行');
                return;
            }
            
            if (mcpServer) {
                mcpServer.close();
                setMcpServer(undefined);
            }
            
            if (httpServer) {
                httpServer.close();
                setHttpServer(undefined);
            }
            
            vscode.window.showInformationMessage('MCP 服务器已停止');
        })
    );

    async function restartServerWithConfig() {
        // 停止现有服务器
        const mcpServer = getMcpServer();
        const httpServer = getHttpServer();
        
        if (mcpServer) {
            mcpServer.close();
            setMcpServer(undefined);
        }
        if (httpServer) {
            httpServer.close();
            setHttpServer(undefined);
        }

        // 获取工作区文件夹
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('未找到工作区文件夹');
            return;
        }

        // 查找当前工作区的配置
        const config = await findSourceNavigatorConfig(workspaceFolders[0]);
        currentConfig = config;
        await startMcpServer(config);
    }

    async function startMcpServer(config: SourceNavigatorConfig): Promise<void> {
        // 创建 MCP 服务器
        const mcpServer = new Server(
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

        setMcpServer(mcpServer);

        // 添加工具处理器
        mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: mcpTools
        }));

        mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: []
        }));

        mcpServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
            templates: []
        }));

        // 添加调用工具处理器
        mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                let result: any;
                
                // 验证文件是否存在
                if (args && typeof args === 'object' && 'textDocument' in args && 
                    args.textDocument && typeof args.textDocument === 'object' && 
                    'uri' in args.textDocument && typeof args.textDocument.uri === 'string') {
                    const uri = vscode.Uri.parse(args.textDocument.uri);
                    try {
                        await vscode.workspace.fs.stat(uri);
                    } catch (error) {
                        return {
                            content: [{ 
                                type: "text", 
                                text: `错误: 文件未找到 - ${uri.fsPath}` 
                            }],
                            isError: true
                        };
                    }
                }
                
                result = await runTool(name, args);

                return { content: [{ type: "text", text: JSON.stringify(result) }] };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [{ type: "text", text: `错误: ${errorMessage}` }],
                    isError: true,
                };
            }
        });

        // 设置 Express 应用
        const app = express();
        app.use(cors());
        app.use(express.json());

        // 跟踪活跃的传输
        const transports: { [sessionId: string]: SSEServerTransport } = {};

        const basePath = getProjectBasePath(config);

        // 创建项目特定的 SSE 端点
        app.get(`${basePath}/sse`, async (req: Request, res: Response) => {
            console.log(`项目 ${config.projectName} 的新 SSE 连接尝试`);
            
            req.socket.setTimeout(0);
            req.socket.setNoDelay(true);
            req.socket.setKeepAlive(true);
            
            try {
                // 创建传输
                const transport = new SSEServerTransport(`${basePath}/message`, res);
                const sessionId = transport.sessionId;
                transports[sessionId] = transport;

                const keepAliveInterval = setInterval(() => {
                    if (res.writable) {
                        res.write(': keepalive\n\n');
                    }
                }, 30000);

                await mcpServer.connect(transport);
                console.log(`服务器已连接到 SSE 传输，会话 ID: ${sessionId}，项目: ${config.projectName}`);
                
                req.on('close', () => {
                    console.log(`SSE 连接已关闭，会话 ${sessionId}`);
                    clearInterval(keepAliveInterval);
                    delete transports[sessionId];
                });
            } catch (error) {
                console.error(`SSE 连接错误: ${error}`);
                res.status(500).send('SSE 连接失败');
            }
        });

        // 创建项目特定的消息端点
        app.post(`${basePath}/message`, async (req: Request, res: Response) => {
            const sessionId = req.headers['x-session-id'] as string;
            const transport = transports[sessionId];
            
            if (!transport) {
                res.status(404).send('会话未找到');
                return;
            }

            try {
                await transport.handleMessage(req.body);
                res.status(200).send('消息已处理');
            } catch (error) {
                console.error(`处理消息时出错: ${error}`);
                res.status(500).send('消息处理失败');
            }
        });

        // 启动 HTTP 服务器
        const httpServer = app.listen(config.port, () => {
            console.log(`Source Navigator MCP 服务器已启动`);
            console.log(`项目: ${config.projectName}`);
            console.log(`端口: ${config.port}`);
            console.log(`SSE 端点: http://localhost:${config.port}${basePath}/sse`);
            console.log(`消息端点: http://localhost:${config.port}${basePath}/message`);
        });

        setHttpServer(httpServer);

        vscode.window.showInformationMessage(
            `Source Navigator MCP 服务器已启动 (端口: ${config.port})`
        );
    }
}

export function deactivate() {
    // 清理资源
    const mcpServer = getMcpServer();
    const httpServer = getHttpServer();
    
    if (mcpServer) {
        mcpServer.close();
        setMcpServer(undefined);
    }
    
    if (httpServer) {
        httpServer.close();
        setHttpServer(undefined);
    }
}

// 辅助函数
function getMcpServer() {
    const { getMcpServer } = require('./globals');
    return getMcpServer();
}

function getHttpServer() {
    const { getHttpServer } = require('./globals');
    return getHttpServer();
} 