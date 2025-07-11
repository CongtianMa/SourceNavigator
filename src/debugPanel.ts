import * as vscode from 'vscode';
import { runTool } from './toolRunner';
import { getMcpServer, getHttpServer } from './globals';

// 创建调试面板
export function createDebugPanel(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'sourceNavigatorDebug',
        'Source Navigator 调试面板',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    panel.webview.html = getWebviewContent();
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'testTool':
                    handleTestTool(message.toolName, message.args, panel);
                    break;
                case 'getServerStatus':
                    handleGetServerStatus(panel);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Source Navigator 调试面板</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
        .container { max-width: 800px; margin: 0 auto; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background-color: var(--vscode-panel-background); }
        .section h2 { margin-top: 0; color: var(--vscode-editor-foreground); }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: 500; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; }
        button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px; }
        button:hover { background-color: var(--vscode-button-hoverBackground); }
        .result { margin-top: 15px; padding: 10px; border-radius: 4px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
        .success { background-color: var(--vscode-debugConsole-infoBackground); border: 1px solid var(--vscode-debugConsole-infoBorder); }
        .error { background-color: var(--vscode-debugConsole-errorBackground); border: 1px solid var(--vscode-debugConsole-errorBorder); }
        .example { background-color: var(--vscode-textBlockQuote-background); border-left: 4px solid var(--vscode-textBlockQuote-border); padding: 10px; margin: 10px 0; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Source Navigator 调试面板</h1>
        <div class="section">
            <h2>服务器状态</h2>
            <button id="checkStatus">检查服务器状态</button>
            <div id="statusResult" class="result"></div>
        </div>
        <div class="section">
            <h2>测试工具</h2>
            <div class="form-group">
                <label for="toolSelect">选择工具:</label>
                <select id="toolSelect">
                    <option value="find_usages">查找引用 (find_usages)</option>
                    <option value="go_to_definition">跳转到定义 (go_to_definition)</option>
                    <option value="get_hover_info">获取悬停信息 (get_hover_info)</option>
                    <option value="get_document_symbols">获取文档符号 (get_document_symbols)</option>
                    <option value="get_workspace_symbols">获取工作区符号 (get_workspace_symbols)</option>
                    <option value="read_file_by_uri">读取文件内容 (read_file_by_uri)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="argsInput">参数 (JSON 格式):</label>
                <textarea id="argsInput" rows="8" placeholder='{
  "textDocument": {
    "uri": "file:///path/to/your/file.ts"
  },
  "position": {
    "line": 10,
    "character": 5
  }
}'></textarea>
            </div>
            <div class="example">
                <strong>示例参数:</strong><br>
                <strong>查找引用:</strong><br>
                <code>{"textDocument":{"uri":"file:///path/to/file.ts"},"position":{"line":10,"character":5}}</code><br><br>
                <strong>获取文档符号:</strong><br>
                <code>{"textDocument":{"uri":"file:///path/to/file.ts"}}</code><br><br>
                <strong>搜索工作区符号:</strong><br>
                <code>{"query":"functionName"}</code><br><br>
                <strong>读取文件内容:</strong><br>
                <code>{"uri":"file:///path/to/file.ts","should_read_entire_file":true}</code><br>
                <code>{"uri":"file:///path/to/file.ts","should_read_entire_file":false,"start_line_one_indexed":1,"end_line_one_indexed_inclusive":10}</code><br><br>
            </div>
            <button id="testTool">测试工具</button>
            <div id="toolResult" class="result"></div>
        </div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('checkStatus').addEventListener('click', () => {
            vscode.postMessage({ command: 'getServerStatus' });
        });
        document.getElementById('testTool').addEventListener('click', () => {
            const toolName = document.getElementById('toolSelect').value;
            const argsText = document.getElementById('argsInput').value;
            try {
                const args = JSON.parse(argsText);
                vscode.postMessage({ command: 'testTool', toolName: toolName, args: args });
            } catch (error) {
                document.getElementById('toolResult').innerHTML = '错误: 无效的 JSON 格式';
                document.getElementById('toolResult').className = 'result error';
            }
        });
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'serverStatus':
                    const statusResult = document.getElementById('statusResult');
                    statusResult.innerHTML = JSON.stringify(message.status, null, 2);
                    statusResult.className = 'result success';
                    break;
                case 'toolResult':
                    const toolResult = document.getElementById('toolResult');
                    toolResult.innerHTML = JSON.stringify(message.result, null, 2);
                    toolResult.className = message.isError ? 'result error' : 'result success';
                    break;
            }
        });
    </script>
</body>
</html>`;
}

async function handleTestTool(toolName: string, args: any, panel: vscode.WebviewPanel) {
    try {
        const result = await runTool(toolName, args);
        panel.webview.postMessage({
            command: 'toolResult',
            result: result,
            isError: false
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        panel.webview.postMessage({
            command: 'toolResult',
            result: { error: errorMessage },
            isError: true
        });
    }
}

function handleGetServerStatus(panel: vscode.WebviewPanel) {
    const mcpServer = getMcpServer();
    const httpServer = getHttpServer();
    const status = {
        running: !!(mcpServer && httpServer),
        port: 8009,
        projectName: "SourceNavigator",
        description: "基于 VSCode 语言服务器的 MCP 服务器",
        mcpServer: !!mcpServer,
        httpServer: !!httpServer,
        timestamp: new Date().toISOString()
    };
    panel.webview.postMessage({
        command: 'serverStatus',
        status: status
    });
}
