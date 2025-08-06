import * as vscode from 'vscode';
import * as path from 'path';

export interface SourceNavigatorConfig {
    projectName: string;
    description: string;
    path: string;
    port: number;
}

/**
 * 全局配置接口
 */
export interface GlobalSourceNavigatorConfig {
    port: number;
    path: string;
}

export const DEFAULT_CONFIG: SourceNavigatorConfig = {
    projectName: "language-tools", 
    description: "Language tools and code analysis",
    path: "",  // Empty path for backwards compatibility
    port: 8010 // Default port for backwards compatibility
};

/**
 * 默认全局配置
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalSourceNavigatorConfig = {
    port: 8010,
    path: ""
};

/**
 * 获取全局配置
 */
export function getGlobalConfig(): GlobalSourceNavigatorConfig {
    const configuration = vscode.workspace.getConfiguration('sourceNavigator');
    
    return {
        port: configuration.get<number>('port') ?? DEFAULT_GLOBAL_CONFIG.port,
        path: configuration.get<string>('path') ?? DEFAULT_GLOBAL_CONFIG.path
    };
}

export async function findSourceNavigatorConfig(workspaceFolder: vscode.WorkspaceFolder): Promise<SourceNavigatorConfig> {
    // 获取全局配置
    const globalConfig = getGlobalConfig();
    
    const configPath = path.join(workspaceFolder.uri.fsPath, 'source-navigator.config.json');
    
    try {
        // Check if config file exists and read it
        const configFile = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
        const configContent = Buffer.from(configFile).toString('utf8');
        const config: SourceNavigatorConfig = JSON.parse(configContent);
        
        // Validate config
        if (!config.projectName || !config.description) {
            throw new Error('Invalid source-navigator.config.json: missing required fields (projectName, description)');
        }

        // 使用全局配置的端口和路径，而不是项目特定的配置
        return {
            projectName: config.projectName,
            description: config.description,
            path: globalConfig.path, // 使用全局配置的路径
            port: globalConfig.port  // 使用全局配置的端口
        };
    } catch (error) {
        console.log(`No valid source-navigator.config.json found in ${workspaceFolder.name}, using default config with global settings`);
        
        // 返回默认配置，但使用全局设置的端口和路径
        return {
            projectName: DEFAULT_CONFIG.projectName,
            description: DEFAULT_CONFIG.description,
            path: globalConfig.path, // 使用全局配置的路径
            port: globalConfig.port  // 使用全局配置的端口
        };
    }
}

export function getProjectBasePath(config: SourceNavigatorConfig): string {
    // For backwards compatibility, if path is empty, return empty string (root path)
    if (!config.path) {
        return '';
    }
    if (!config.path.startsWith('/')) {
        config.path = '/' + config.path;
    }
    return `${config.path}`;
} 