import * as vscode from 'vscode';
import * as path from 'path';
import { createVscodePosition, getPreview, asyncMap, createVscodeUri, getSymbolKindString, getRichPreview, isExternalUri } from './helpers';
import { mcpTools } from './tools';

const toolNames = mcpTools.map((tool) => tool.name);



export const runTool = async (name: string, args: any) => {
    let result: any;
    if (!toolNames.includes(name)) {
        throw new Error(`Unknown tool: ${name}`);
    }
    

    switch (name) {

        case "go_to_definition":
            result = await handleGoToDefinition(args);
            break;
        case "get_symbol_definition":
            result = await findSymbol(args);
            break;
        case "get_type_definition":
            result = await findSymbol(args);
            break;
        case "read_outer_file":
            result = await handleReadFile(args);
            break;
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
    return result;
};



async function handleGoToDefinition(args: any) {
    let uri: vscode.Uri;
    try {
        uri = await createVscodeUri(args?.target_file ?? '');
    } catch (error) {
        return {
            error: `Invalid file path: ${args?.target_file}`,
            isError: true
        };
    }

    const position = args?.position ? createVscodePosition(
        args.position.line,
        args.position.character
    ) : undefined;
    const commandResult = await vscode.commands.executeCommand<vscode.Location[]>(
        'vscode.executeDefinitionProvider',
        uri,
        position
    );
    return await asyncMap(commandResult, async (def: vscode.Location) => ({
        file_path: def.uri.toString(),
        start_line: def.range?.start.line,
        end_line: def.range?.end.line,
        preview: await getRichPreview(def.uri, def.range?.start.line)
    }));
}


async function handleReadFile(args: any) {
    const targetFile = args.target_file;
    if (!targetFile) {
        return { 
            error: "target_file is required",
            isError: true 
        };
    }

    let fileUri: vscode.Uri;
    try {
        fileUri = await createVscodeUri(targetFile);
    } catch (error) {
        return {
            error: `Invalid file path: ${targetFile}`,
            isError: true
        };
    }

    const document = await vscode.workspace.openTextDocument(fileUri);
    const totalLines = document.lineCount;

    if (args.should_read_entire_file) {
        return {
            file_path: fileUri.toString(),
            content: document.getText(),
            start_line: 1,
            end_line: totalLines,
            total_lines: totalLines,
            summary: {
                lines_before: 'The file is not truncated at the beginning.',
                lines_after: 'The file is not truncated at the end.'
            }
        };
    }

    const startLineOneBased = args?.start_line_one_indexed ?? 1;
    const startLineZeroBased = startLineOneBased - 1;
    
    // 如果未提供结束行，则默认读取200行
    const endLineOneBased = args?.end_line_one_indexed_inclusive ?? (startLineOneBased + 199);
    const endLineZeroBased = endLineOneBased - 1;

    if (startLineZeroBased >= totalLines) {
        return {
            error: `Start line (${startLineOneBased}) exceeds total lines (${totalLines}).`,
            isError: true,
        };
    }

    const clampedStartLine = Math.max(0, startLineZeroBased);
    const clampedEndLine = Math.min(endLineZeroBased, totalLines - 1);

    if (clampedStartLine > clampedEndLine) {
        return {
            error: `Start line (${startLineOneBased}) is greater than end line (${endLineOneBased}).`,
            isError: true,
        };
    }

    const selectedLines = document.getText(new vscode.Range(clampedStartLine, 0, clampedEndLine, Number.MAX_VALUE));
    
    const linesBeforeSummary = clampedStartLine > 0
        ? `There are ${clampedStartLine} lines at the beginning that are not displayed.`
        : 'The file is not truncated at the beginning.';

    const linesAfterCount = totalLines - (clampedEndLine + 1);
    const linesAfterSummary = linesAfterCount > 0
        ? `There are ${linesAfterCount} lines at the end that are not displayed.`
        : 'The file is not truncated at the end.';

    return {
        file_path: fileUri.toString(),
        content: selectedLines,
        start_line: clampedStartLine + 1,
        end_line: clampedEndLine + 1,
        total_lines: totalLines,
        summary: {
            lines_before: linesBeforeSummary,
            lines_after: linesAfterSummary
        }
    };
}


async function findSymbol(args: any) {
    let query = args.query || args.name || '';
    const containerName = args.container_name || '';
    if (containerName) {
        query = `${containerName}.${query}`;
    }
    const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        query
    );
    if (!symbols) {
        return [];
    }
    return await asyncMap(symbols.slice(0, 5), async (symbol: vscode.SymbolInformation) => ({
        name: symbol.name,
        kind: getSymbolKindString(symbol.kind),
        is_external: await isExternalUri(symbol.location.uri),
        file_path: symbol.location.uri.toString(),
        container_name: symbol.containerName,
        preview: await getRichPreview(symbol.location.uri, symbol.location.range.start.line)
    }));
}



