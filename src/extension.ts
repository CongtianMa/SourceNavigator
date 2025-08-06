import * as vscode from 'vscode';
import { createDebugPanel } from './debugPanel';
import { findSourceNavigatorConfig, SourceNavigatorConfig } from './config';
import { sharedServerManager } from './sharedServerManager';
import { sharedIpcClient } from './sharedIpcClient';

export async function activate(context: vscode.ExtensionContext) {
    let currentConfig: SourceNavigatorConfig | null = null;
    let isRegistered = false;

    // 处理工作区文件夹变化
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            await registerToSharedServer();
        })
    );

    // 初始注册到共享服务器
    await registerToSharedServer();

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
                if (isRegistered) {
                    vscode.window.showInformationMessage(`SourceNavigator已运行: ${currentConfig?.projectName || 'unknown'}`);
                    return;
                }
                await registerToSharedServer();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`SourceNavigator启动失败: ${errorMsg}`);
            }
        }),
        vscode.commands.registerCommand('source-navigator.stopServer', async () => {
            try {
                if (!isRegistered) {
                    vscode.window.showInformationMessage('SourceNavigator未运行');
                    return;
                }
                
                await unregisterFromSharedServer();
                vscode.window.showInformationMessage('SourceNavigator已断开连接');
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`SourceNavigator停止失败: ${errorMsg}`);
            }
        })
    );

    async function registerToSharedServer() {
        try {
            // 如果已经注册，先注销
            if (isRegistered) {
                await unregisterFromSharedServer();
            }

            // 获取工作区文件夹
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                console.log('[Extension] 未找到工作区文件夹，跳过MCP服务器注册');
                return;
            }

            const workspaceFolder = workspaceFolders[0];
            const workspacePath = workspaceFolder.uri.fsPath;
            const workspaceName = workspaceFolder.name;

            // 查找配置文件
            const config = await findSourceNavigatorConfig(workspaceFolder);
            currentConfig = config!;
            
            console.log(`[Extension] 注册到共享MCP服务器: ${workspaceName}`);

            // 注册到共享服务器管理器（自动处理服务器启动和IPC连接）
            await sharedServerManager.registerClient({
                workspacePath,
                workspaceName,
                clientId: sharedIpcClient.clientId,
                config: currentConfig,
                pid: process.pid
            });

            // 建立IPC连接并注册客户端
            await sharedIpcClient.registerToSharedServer(currentConfig, workspacePath, workspaceName);
            
            isRegistered = true;
            console.log(`[Extension] 注册成功: ${workspaceName}`);
            
            // 显示成功消息
            vscode.window.showInformationMessage(
                `SourceNavigator已连接: ${workspaceName}`, 
                '查看状态'
            ).then(selection => {
                if (selection === '查看状态') {
                    vscode.commands.executeCommand('source-navigator.openDebugPanel');
                }
            });
            
        } catch (error) {
            console.error('[Extension] 注册失败:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
                `SourceNavigator连接失败: ${errorMsg}`, 
                '重试', '查看详情'
            ).then(selection => {
                if (selection === '重试') {
                    registerToSharedServer();
                } else if (selection === '查看详情') {
                    vscode.commands.executeCommand('source-navigator.openDebugPanel');
                }
            });
        }
    }

    async function unregisterFromSharedServer() {
        if (!isRegistered) {
            return;
        }

        try {
            console.log('[Extension] 从共享MCP服务器注销');
            
            // 从IPC客户端注销
            await sharedIpcClient.unregisterFromSharedServer();
            
            // 从共享服务器管理器注销
            await sharedServerManager.unregisterClient(sharedIpcClient.clientId);
            
            isRegistered = false;
            console.log('[Extension] 成功从共享MCP服务器注销');
            
        } catch (error) {
            console.error('从共享MCP服务器注销失败:', error);
            throw error;
        }
    }
}

export async function deactivate() {
    console.log('[Extension] 停用SourceNavigator扩展...');
    try {
        // 清理连接
        await sharedIpcClient.unregisterFromSharedServer();
        await sharedServerManager.unregisterClient(sharedIpcClient.clientId);
        sharedIpcClient.disconnect();
        console.log('[Extension] 扩展已安全停用');
    } catch (error) {
        console.error('[Extension] 停用扩展时出错:', error);
    }
}