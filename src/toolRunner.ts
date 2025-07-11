import * as vscode from 'vscode';
import { getPreview, asyncMap } from './helpers';

// 工具运行器 - 实现各种语言服务器功能
export async function runTool(name: string, args: any): Promise<any> {
    try {
        switch (name) {
            case 'go_to_definition':
                return await goToDefinition(args);
            case 'read_file_by_uri':
                return await readFileByUri(args);
            default:
                throw new Error(`未知的工具: ${name}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`执行工具 ${name} 时出错: ${errorMessage}`);
    }
}

// 跳转到定义
async function goToDefinition(args: any): Promise<any> {
    const { textDocument, position } = args;
    const uri = vscode.Uri.parse(textDocument.uri);
    const pos = new vscode.Position(position.line-1, position.character);
    
    // 使用 VSCode 的原生 API 获取定义
    const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        uri,
        pos
    );
    
    if (!definitions || definitions.length === 0) {
        return { definitions: [] };
    }

    return asyncMap(definitions, async def => ({
        uri: def.uri.toString(),
        range: {
            start: { 
                line: def.range.start.line+1, 
                character: def.range.start.character 
            },
            end: { 
                line: def.range.end.line+1, 
                character: def.range.end.character }
        },
        preview: await getPreview(def.uri, def.range.start.line)
    }));
    
} 

// 读取文件内容 by URI
async function readFileByUri(args: any): Promise<any> {
    const { uri, should_read_entire_file, start_line_one_indexed, end_line_one_indexed_inclusive } = args;
    const parsedUri = vscode.Uri.parse(uri);
    const document = await vscode.workspace.openTextDocument(parsedUri);
    if (should_read_entire_file) {
        return {
            file_content: document.getText(),
            summary_of_other_lines: ''
        };
    } else {
        const start = (start_line_one_indexed ?? 1) - 1;
        const end = (end_line_one_indexed_inclusive ?? start + 1) - 1;
        const selectedLines = document.getText(new vscode.Range(start, 0, end, Number.MAX_VALUE));
        let summary = '';
        if (start > 0) summary += `Lines 1-${start} not shown. `;
        if (end < document.lineCount - 1) summary += `Lines ${end + 2}-${document.lineCount} not shown.`;
        return {
            file_content: selectedLines,
            summary_of_other_lines: summary.trim()
        };
    }
} 
