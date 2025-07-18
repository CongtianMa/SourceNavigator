import path from 'path';
import * as vscode from 'vscode';
export interface DocumentSymbolResult {
    name: string;
    detail: string;
    kind: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    selectionRange: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    children: DocumentSymbolResult[];
}

export interface RichPreview {
    snippet_content: string;
    total_lines_in_file: number;
    line: number;
}

export function convertSymbol(symbol: vscode.DocumentSymbol): DocumentSymbolResult {
    return {
        name: symbol.name,
        detail: symbol.detail,
        kind: getSymbolKindString(symbol.kind),
        range: {
            start: {
                line: symbol.range.start.line,
                character: symbol.range.start.character
            },
            end: {
                line: symbol.range.end.line,
                character: symbol.range.end.character
            }
        },
        selectionRange: {
            start: {
                line: symbol.selectionRange.start.line,
                character: symbol.selectionRange.start.character
            },
            end: {
                line: symbol.selectionRange.end.line,
                character: symbol.selectionRange.end.character
            }
        },
        children: symbol.children.map(convertSymbol)
    };
}

export function getSymbolKindString(kind: vscode.SymbolKind): string {
    return vscode.SymbolKind[kind];
}

export async function getPreview(uri: vscode.Uri, line: number | undefined): Promise<string> {
    if (line === null || line === undefined) {
        return "";
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const lineText = document.lineAt(line).text.trim();
    return lineText;
}

export async function getRichPreview(uri: vscode.Uri, line: number | undefined): Promise<RichPreview | undefined> {
    if (line === null || line === undefined) {
        return undefined;
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const lineText = document.lineAt(line).text;
    return {
        snippet_content: lineText,
        total_lines_in_file: document.lineCount,
        line: line+1
    };
}

export async function isExternalUri(uri: vscode.Uri): Promise<boolean> {
    if (uri.scheme === 'file') {
        return await vscode.workspace.fs.stat(uri).then(() => false, () => true);
    } else {
        return true;
    }
}
 
export function createVscodePosition(line: number, character: number): vscode.Position | undefined {
    if (line === null || line === undefined) {
        return undefined;
    }
    if (character === null || character === undefined) {
        return undefined;
    }
    return new vscode.Position(
        Math.max(line, 0),
        Math.max(character, 0)
    );
}

export async function createVscodeUri(filePath: string): Promise<vscode.Uri> {
    if (path.isAbsolute(filePath)) {
        return vscode.Uri.file(filePath);
    } else {
        try {
            return vscode.Uri.parse(filePath, true);
        } catch (error) {
        }
    }
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            const fullPath = vscode.Uri.joinPath(folder.uri, filePath);
            if (await vscode.workspace.fs.stat(fullPath).then(() => true, () => false)) {
                return fullPath;
            }
        }
    }
    throw new Error(`Invalid file path: ${filePath}`);
}

export async function asyncMap<T, R>(array: T[], asyncCallback: (item: T) => Promise<R>): Promise<R[]> {
    return Promise.all(array.map(asyncCallback));
}

export function convertSemanticTokens(semanticTokens: vscode.SemanticTokens, document: vscode.TextDocument): any {
    const tokens: any[] = [];
    let prevLine = 0;
    let prevChar = 0;

    // Token types and modifiers from VS Code
    const tokenTypes = [
        'namespace', 'type', 'class', 'enum', 'interface',
        'struct', 'typeParameter', 'parameter', 'variable', 'property',
        'enumMember', 'event', 'function', 'method', 'macro',
        'keyword', 'modifier', 'comment', 'string', 'number',
        'regexp', 'operator', 'decorator'
    ];

    const tokenModifiers = [
        'declaration', 'definition', 'readonly', 'static',
        'deprecated', 'abstract', 'async', 'modification',
        'documentation', 'defaultLibrary'
    ];

    // Process tokens in groups of 5 (format: deltaLine, deltaStartChar, length, tokenType, tokenModifiers)
    for (let i = 0; i < semanticTokens.data.length; i += 5) {
        const deltaLine = semanticTokens.data[i];
        const deltaStartChar = semanticTokens.data[i + 1];
        const length = semanticTokens.data[i + 2];
        const tokenType = tokenTypes[semanticTokens.data[i + 3]] || 'unknown';
        const tokenModifiersBitset = semanticTokens.data[i + 4];

        // Calculate absolute position
        const line = prevLine + deltaLine;
        const startChar = deltaLine === 0 ? prevChar + deltaStartChar : deltaStartChar;

        // Get the actual text content
        const tokenText = document.lineAt(line).text.substr(startChar, length);

        // Convert token modifiers bitset to array of strings
        const modifiers = tokenModifiers.filter((_, index) => tokenModifiersBitset & (1 << index));

        tokens.push({
            line,
            startCharacter: startChar,
            length,
            tokenType,
            modifiers,
            text: tokenText
        });

        prevLine = line;
        prevChar = startChar;
    }

    return tokens;
}

