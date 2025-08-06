import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Server as HttpServer } from 'http';
import { ChildProcess } from 'child_process';
import { McpIpcClient } from './ipcClient';

// 保留原有的服务器变量用于兼容性（现在主要用于状态检查）
export let mcpServer: Server | undefined;
export let httpServer: HttpServer | undefined;

// 新增进程管理相关变量
export let mcpServerProcess: ChildProcess | undefined;
export let ipcClient: McpIpcClient | undefined;

export const setMcpServer = (server: Server | undefined) => {
    mcpServer = server;
}

export const setHttpServer = (server: HttpServer | undefined) => {
    httpServer = server;
}

export const setMcpServerProcess = (process: ChildProcess | undefined) => {
    mcpServerProcess = process;
}

export const setIpcClient = (client: McpIpcClient | undefined) => {
    ipcClient = client;
}
