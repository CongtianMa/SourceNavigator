import * as vscode from 'vscode';

// 获取文件的语言 ID
export function getLanguageId(uri: vscode.Uri): string {
    const extension = uri.path.split('.').pop()?.toLowerCase();
    
    // 常见文件扩展名到语言 ID 的映射
    const languageMap: { [key: string]: string } = {
        'ts': 'typescript',
        'js': 'javascript',
        'tsx': 'typescriptreact',
        'jsx': 'javascriptreact',
        'py': 'python',
        'java': 'java',
        'cs': 'csharp',
        'cpp': 'cpp',
        'c': 'c',
        'h': 'cpp',
        'hpp': 'cpp',
        'go': 'go',
        'rs': 'rust',
        'php': 'php',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin',
        'scala': 'scala',
        'clj': 'clojure',
        'hs': 'haskell',
        'ml': 'ocaml',
        'fs': 'fsharp',
        'dart': 'dart',
        'r': 'r',
        'm': 'objective-c',
        'mm': 'objective-cpp',
        'pl': 'perl',
        'sh': 'shellscript',
        'ps1': 'powershell',
        'bat': 'batch',
        'cmd': 'batch',
        'sql': 'sql',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'toml': 'toml',
        'ini': 'ini',
        'cfg': 'ini',
        'conf': 'ini',
        'md': 'markdown',
        'txt': 'plaintext'
    };
    
    return languageMap[extension || ''] || 'plaintext';
}

// 检查文件是否在工作区内
export function isFileInWorkspace(uri: vscode.Uri): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return false;
    }
    
    return workspaceFolders.some(folder => {
        const folderPath = folder.uri.fsPath;
        const filePath = uri.fsPath;
        return filePath.startsWith(folderPath);
    });
}

// 获取文件的相对路径
export function getRelativePath(uri: vscode.Uri): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return uri.fsPath;
    }
    
    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;
        const filePath = uri.fsPath;
        if (filePath.startsWith(folderPath)) {
            return filePath.substring(folderPath.length + 1); // +1 for the path separator
        }
    }
    
    return uri.fsPath;
}

// 格式化位置信息
export function formatPosition(position: vscode.Position): string {
    return `第 ${position.line + 1} 行，第 ${position.character + 1} 列`;
}

// 格式化范围信息
export function formatRange(range: vscode.Range): string {
    return `${formatPosition(range.start)} - ${formatPosition(range.end)}`;
}

// 获取符号类型的友好名称
export function getSymbolKindName(kind: vscode.SymbolKind): string {
    const kindNames: { [key in vscode.SymbolKind]: string } = {
        [vscode.SymbolKind.File]: '文件',
        [vscode.SymbolKind.Module]: '模块',
        [vscode.SymbolKind.Namespace]: '命名空间',
        [vscode.SymbolKind.Package]: '包',
        [vscode.SymbolKind.Class]: '类',
        [vscode.SymbolKind.Method]: '方法',
        [vscode.SymbolKind.Property]: '属性',
        [vscode.SymbolKind.Field]: '字段',
        [vscode.SymbolKind.Constructor]: '构造函数',
        [vscode.SymbolKind.Enum]: '枚举',
        [vscode.SymbolKind.Interface]: '接口',
        [vscode.SymbolKind.Function]: '函数',
        [vscode.SymbolKind.Variable]: '变量',
        [vscode.SymbolKind.Constant]: '常量',
        [vscode.SymbolKind.String]: '字符串',
        [vscode.SymbolKind.Number]: '数字',
        [vscode.SymbolKind.Boolean]: '布尔值',
        [vscode.SymbolKind.Array]: '数组',
        [vscode.SymbolKind.Object]: '对象',
        [vscode.SymbolKind.Key]: '键',
        [vscode.SymbolKind.Null]: '空值',
        [vscode.SymbolKind.EnumMember]: '枚举成员',
        [vscode.SymbolKind.Struct]: '结构体',
        [vscode.SymbolKind.Event]: '事件',
        [vscode.SymbolKind.Operator]: '操作符',
        [vscode.SymbolKind.TypeParameter]: '类型参数'
    };
    
    return kindNames[kind] || '未知';
}

// 验证 URI 格式
export function isValidUri(uriString: string): boolean {
    try {
        const uri = vscode.Uri.parse(uriString);
        return uri.scheme === 'file';
    } catch {
        return false;
    }
}

// 获取文件内容
export async function getFileContent(uri: vscode.Uri): Promise<string> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
    } catch (error) {
        throw new Error(`无法读取文件内容: ${error}`);
    }
}

// 获取文件的行内容
export async function getFileLines(uri: vscode.Uri, startLine: number, endLine: number): Promise<string[]> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const lines: string[] = [];
        
        for (let i = startLine; i <= endLine && i < document.lineCount; i++) {
            lines.push(document.lineAt(i).text);
        }
        
        return lines;
    } catch (error) {
        throw new Error(`无法读取文件行: ${error}`);
    }
} 

export async function getPreview(uri: vscode.Uri, line: number | undefined): Promise<string> {
    if (line === null || line === undefined) {
        return "";
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const lineText = document.lineAt(line).text.trim();
    return lineText;
}

export async function asyncMap<T, R>(array: T[], asyncCallback: (item: T) => Promise<R>): Promise<R[]> {
    return Promise.all(array.map(asyncCallback));
}