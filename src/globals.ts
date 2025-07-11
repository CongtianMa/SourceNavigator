import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Server as HttpServer } from 'http';

// 全局 MCP 服务器实例
let mcpServer: Server | undefined;
let httpServer: HttpServer | undefined;

// 设置 MCP 服务器实例
export function setMcpServer(server: Server | undefined) {
    mcpServer = server;
}

// 获取 MCP 服务器实例
export function getMcpServer(): Server | undefined {
    return mcpServer;
}

// 设置 HTTP 服务器实例
export function setHttpServer(server: HttpServer | undefined) {
    httpServer = server;
}

// 获取 HTTP 服务器实例
export function getHttpServer(): HttpServer | undefined {
    return httpServer;
} 