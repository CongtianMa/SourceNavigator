import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// 项目配置接口
export interface SourceNavigatorConfig {
    projectName: string;
    description: string;
    path: string;
    port: number;
}

// 默认配置
export const DEFAULT_CONFIG: SourceNavigatorConfig = {
    projectName: "SourceNavigator",
    description: "基于 VSCode 语言服务器的 MCP 服务器",
    path: "/source-navigator",
    port: 8009
};

// 查找项目配置文件
export async function findSourceNavigatorConfig(workspaceFolder: vscode.WorkspaceFolder): Promise<SourceNavigatorConfig> {
    const configPath = path.join(workspaceFolder.uri.fsPath, 'source-navigator.config.json');
    
    try {
        const configData = await fs.promises.readFile(configPath, 'utf8');
        const config = JSON.parse(configData) as Partial<SourceNavigatorConfig>;
        
        // 合并默认配置和用户配置
        return {
            ...DEFAULT_CONFIG,
            ...config,
            projectName: config.projectName || workspaceFolder.name,
            description: config.description || `项目: ${workspaceFolder.name}`,
            path: config.path || `/${workspaceFolder.name.toLowerCase().replace(/\s+/g, '-')}`,
            port: config.port || DEFAULT_CONFIG.port
        };
    } catch (error) {
        // 如果配置文件不存在，使用默认配置
        console.log(`未找到配置文件 ${configPath}，使用默认配置`);
        return {
            ...DEFAULT_CONFIG,
            projectName: workspaceFolder.name,
            description: `项目: ${workspaceFolder.name}`,
            path: `/${workspaceFolder.name.toLowerCase().replace(/\s+/g, '-')}`,
            port: DEFAULT_CONFIG.port
        };
    }
}

// 获取项目基础路径
export function getProjectBasePath(config: SourceNavigatorConfig): string {
    return config.path;
} 