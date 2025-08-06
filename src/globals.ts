/**
 * 全局状态管理 - 简化版
 * 注意：随着架构演进到共享服务器模式，此文件的作用已经大大简化
 * 主要用于向后兼容和状态检查
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Server as HttpServer } from 'http';

// 保留用于兼容性检查的服务器变量
export let mcpServer: Server | undefined;
export let httpServer: HttpServer | undefined;

export const setMcpServer = (server: Server | undefined) => {
    mcpServer = server;
}

export const setHttpServer = (server: HttpServer | undefined) => {
    httpServer = server;
}
