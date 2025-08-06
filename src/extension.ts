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
                    vscode.window.showInformationMessage(`MCP服务器已在运行，项目: ${currentConfig?.projectName || 'unknown'}`);
                    return;
                }
                await registerToSharedServer();
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`启动MCP服务器失败: ${errorMsg}`);
            }
        }),
        vscode.commands.registerCommand('source-navigator.stopServer', async () => {
            try {
                if (!isRegistered) {
                    vscode.window.showInformationMessage('当前没有运行的MCP服务器');
                    return;
                }
                
                await unregisterFromSharedServer();
                vscode.window.showInformationMessage('已从共享MCP服务器注销');
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`停止MCP服务器失败: ${errorMsg}`);
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
                console.log('未找到工作区文件夹，跳过MCP服务器注册');
                return;
            }

            const workspaceFolder = workspaceFolders[0];
            const workspacePath = workspaceFolder.uri.fsPath;
            const workspaceName = workspaceFolder.name;

            // 在当前工作区中查找配置
            const config = await findSourceNavigatorConfig(workspaceFolder);
            currentConfig = config!;
            
            console.log(`[Extension] 开始注册到共享MCP服务器: ${workspaceName} (${workspacePath})`);

            // 步骤1: 检查并启动共享服务器（如果需要）
            console.log(`[Extension] 检查共享服务器状态...`);
            const isServerRunning = sharedServerManager.isServerRunning();
            
            if (!isServerRunning) {
                console.log(`[Extension] 共享服务器未运行，将通过注册过程启动`);
            } else {
                console.log(`[Extension] 共享服务器已在运行`);
            }

            // 步骤2: 注册到共享服务器管理器（这会自动检查现有服务器或启动新的）
            await sharedServerManager.registerClient({
                workspacePath,
                workspaceName,
                clientId: sharedIpcClient.clientId,
                config: currentConfig,
                pid: process.pid
            });

            // 步骤3: 验证服务器已可用
            if (!sharedServerManager.isServerRunning()) {
                throw new Error('共享服务器未能正确启动或连接');
            }

            console.log(`[Extension] 共享服务器已就绪，端口: ${sharedServerManager.getServerPort()}`);

            // 步骤4: 建立IPC连接并注册客户端
            console.log(`[Extension] 连接到共享服务器IPC...`);
            await sharedIpcClient.registerToSharedServer(currentConfig, workspacePath, workspaceName);
            
            isRegistered = true;
            console.log(`[Extension] 成功注册到共享MCP服务器: ${workspaceName}`);
            
            // 显示成功消息
            vscode.window.showInformationMessage(`已连接到共享MCP服务器: ${workspaceName}`, 
                '查看状态').then(selection => {
                if (selection === '查看状态') {
                    vscode.commands.executeCommand('source-navigator.openDebugPanel');
                }
            });
            
        } catch (error) {
            console.error('注册到共享MCP服务器失败:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`注册到共享MCP服务器失败: ${errorMsg}`, '重试', '查看详情').then(selection => {
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
    console.log('[Extension] 正在停用扩展...');
    try {
        // 从共享服务器注销
        await sharedIpcClient.unregisterFromSharedServer();
        await sharedServerManager.unregisterClient(sharedIpcClient.clientId);
        
        // 断开IPC连接
        sharedIpcClient.disconnect();
    } catch (error) {
        console.error('[Extension] 停用扩展时出错:', error);
    }
}