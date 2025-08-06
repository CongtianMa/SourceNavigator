import * as vscode from 'vscode';
import { createDebugPanel } from './debugPanel';
import { mcpServerProcess, ipcClient } from './globals';
import { findSourceNavigatorConfig, SourceNavigatorConfig } from './config';
import { processManager } from './processManager';

export async function activate(context: vscode.ExtensionContext) {
    let currentConfig: SourceNavigatorConfig | null = null;

    // 处理工作区文件夹变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            await restartServerWithConfig();
        })
    );

    // 初始启动服务器
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
                if (processManager.isProcessRunning()) {
                    vscode.window.showInformationMessage(`MCP服务器已在运行，项目: ${currentConfig?.projectName || 'unknown'}`);
                    return;
                }
                await restartServerWithConfig();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`启动MCP服务器失败: ${errorMsg}`);
            }
        }),
        vscode.commands.registerCommand('source-navigator.stopServer', async () => {
            try {
                if (!processManager.isProcessRunning()) {
                    vscode.window.showInformationMessage('当前没有运行的MCP服务器');
                    return;
                }
                
                await processManager.stopServerProcess();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`停止MCP服务器失败: ${errorMsg}`);
            }
        })
    );

    async function restartServerWithConfig() {
        try {
            // 停止现有服务器（如果正在运行）
            if (processManager.isProcessRunning()) {
                await processManager.stopServerProcess();
            }

            // 获取工作区文件夹
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('未找到工作区文件夹');
                return;
            }

            // 在当前工作区中查找配置 - 如果未找到将返回 DEFAULT_CONFIG
            const config = await findSourceNavigatorConfig(workspaceFolders[0]);
            currentConfig = config!; // 我们知道这永远不会为null，因为findSourceNavigatorConfig总是返回DEFAULT_CONFIG
            
            // 启动新的MCP服务器进程
            await processManager.startServerProcess(config!);
        } catch (error) {
            console.error('重启MCP服务器失败:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`重启MCP服务器失败: ${errorMsg}`);
        }
    }


}

export async function deactivate() {
    console.log('[Extension] 正在停用扩展...');
    try {
        // 停止MCP服务器进程
        if (processManager.isProcessRunning()) {
            await processManager.stopServerProcess();
        }
    } catch (error) {
        console.error('[Extension] 停用扩展时出错:', error);
    }
}