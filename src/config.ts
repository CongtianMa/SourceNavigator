import * as vscode from 'vscode';

/**
 * 全局配置接口
 */
export interface GlobalSourceNavigatorConfig {
    port: number;
}

/**
 * 默认全局配置
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalSourceNavigatorConfig = {
    port: 8010
};

/**
 * 获取全局配置
 */
export function getGlobalConfig(): GlobalSourceNavigatorConfig {
    const configuration = vscode.workspace.getConfiguration('sourceNavigator');
    
    return {
        port: configuration.get<number>('port') ?? DEFAULT_GLOBAL_CONFIG.port
    };
} 