import * as vscode from 'vscode';
import { mcpTools } from './tools';

const toolNames = mcpTools.map((tool) => tool.name);



export const runTool = async (name: string, args: any) => {
    let result: any;
    if (!toolNames.includes(name)) {
        throw new Error(`Unknown tool: ${name}`);
    }
    

    switch (name) {

        case "class_source":
            result = await handleClassSource(args);
            break;
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
    return result;
};


async function handleClassSource(args: any): Promise<any> {
    const className = args.class_name;
    const lineOffset = args.line_offset ?? 0;
    const lineLimit = args.line_limit ?? 500;

    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        className
    );
    if (!symbols) {
        return {
            "result": "Class not found: " + className,
        };
    }

    const filteredSymbols = symbols.filter(symbol => {
        return symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Interface || symbol.kind === vscode.SymbolKind.Enum || symbol.kind === vscode.SymbolKind.Struct;
    }).filter(symbol => {
        return symbol.name === className || (symbol.containerName && symbol.containerName+"."+symbol.name === className);
    });
    if (filteredSymbols.length === 0) {
        return {
            "result": "未找到类 " + className,
        };
    }
    const qualifiedNames = new Set(filteredSymbols.map(symbol => symbol.containerName + "." + symbol.name));
    if (qualifiedNames.size > 1) {
        return {
            "result": "找到多个类 " + className,
            "sameNameClass": Array.from(qualifiedNames)
        };
    }
    const symbol = filteredSymbols[0];
    const document = await vscode.workspace.openTextDocument(symbol.location.uri);
    const sourceCode = document.getText(new vscode.Range(lineOffset, 0, lineOffset+lineLimit, Number.MAX_VALUE));
    
    return {
        "result": "已找到类 " + className,
        "file_path": symbol.location.uri.toString(),
        "source_code": sourceCode,
        "total_lines": document.lineCount,
        "summary": {
            "linesBefore": "返回内容前有"+lineOffset+"行",
            "linesAfter": "返回内容后有" + Math.max(0, document.lineCount - lineOffset - lineLimit) + "行"
        }
    };
}

