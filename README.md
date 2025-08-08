# SourceNavigator - AI Code Analysis Assistant

<a href="https://marketplace.visualstudio.com/items?itemName=congtian.source-navigator">
  <img src="https://img.shields.io/visual-studio-marketplace/d/congtian.source-navigator?label=VSCode%20Extension%20Downloads&cacheSeconds=3600" 
       alt="VSCode Extension Downloads" 
       width="250">
</a>

## 🎯 Project Goal

SourceNavigator solves the core problem that AI programming assistants like Cursor cannot read source code from external dependencies. By providing intelligent code navigation and analysis tools, it enables AI assistants to:

- **Deep Dependency Understanding**: Read and analyze source code from external libraries and frameworks
- **Intelligent Type Analysis**: Search and analyze type definitions across workspaces
- **Multi-Window Support**: Support multiple VSCode windows with intelligent routing via workspace paths
- **Language Extensibility**: Currently primarily supports Java, with architecture ready for other languages

## 🏗️ Architecture

SourceNavigator uses a modern architecture with separate processes for better performance and stability:

### **Separate MCP Server Process**
- The extension runs a dedicated MCP server process independent of the VSCode extension
- This ensures stable service even if the VSCode extension is reloaded or updated
- The server process can handle multiple VSCode windows simultaneously

### **IPC Communication**
- The VSCode extension and MCP server communicate via Inter-Process Communication (IPC)
- This provides fast, reliable communication between the extension and server
- IPC allows for efficient data transfer and real-time updates

### **Global Configuration**
- Uses a simplified global configuration approach
- No project-specific configuration files required
- The extension automatically detects workspace information from VSCode

## ✨ Core Features

### 🔍 External Dependency Source Code Reading
- Intelligently read source code from external libraries and frameworks
- Support for various URI formats and line range specifications
- Enable AI assistants to understand complete code context

### 🏗️ Multi-VSCode Window Support
- Support for multiple VSCode windows simultaneously
- Automatic routing to corresponding windows via workspace paths in tool calls
- Each window uses the same global MCP server instance

### 🚀 Easy to Use
- One-click installation with automatic configuration
- No complex project configuration files required
- Seamless integration with mainstream AI assistants

### 🔧 Language Support
- **Primary Support**: Java (full support)
- **Extensible Architecture**: Ready to support other programming languages
- **Intelligent Analysis**: Code understanding based on language-specific features

## 📦 Installation & Usage

### 1. Install Extension
Install SourceNavigator extension from the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=congtian.source-navigator)

### 2. Configure AI Assistant

#### Cursor Configuration
Add to your `.cursorrules` file:
```json
{
  "mcpServers": {
    "SourceNavigator": {
      "url": "http://localhost:8010/sse"
    }
  }
}
```

### 3. Start Using
The extension automatically starts the MCP server process, and AI assistants can immediately access external dependency source code.

## 🛠️ Available Tools

### `class_source`
Find class files by class name and return source code information. Supports both local project classes and third-party library classes.

```json
{
  "name": "class_source",
  "arguments": {
    "workspace_path": "/path/to/your/workspace",
    "class_name": "MyClass",
    "line_offset": 0,
    "line_limit": 500
  }
}
```

**Features:**
- Supports short class names and fully qualified class names
- Automatic decompilation for third-party classes without source code
- Returns all matching fully qualified class names when multiple classes have the same name
- Default returns first 500 lines, customizable with `line_offset` and `line_limit`
- Works with both local project classes and external dependencies

## ⚙️ Configuration

### Global Configuration
Configure the server port globally in VSCode settings:

1. Open VSCode Settings (Ctrl/Cmd + ,)
2. Search for "SourceNavigator"
3. Set **SourceNavigator: Port** (default: 8010)

Or add to your `settings.json`:
```json
{
  "sourceNavigator.port": 8010
}
```

## 🎯 Use Cases

### Case 1: Understanding External Library Source Code
When AI assistants need to understand third-party libraries used in projects, they can directly read and analyze their source code.

### Case 2: Multi-Project Development
Develop different projects simultaneously in multiple VSCode windows, each with independent code analysis services.

### Case 3: Complex Dependency Analysis
Analyze complex dependency relationships in projects, enabling AI assistants to provide more accurate code suggestions.

## 🔧 Troubleshooting

1. **Port Conflicts**: Ensure the configured port is not occupied
2. **Language Support**: Ensure appropriate language extensions are installed
3. **Project Loading**: Ensure projects are correctly loaded in VSCode
4. **Server Process**: Check if the MCP server process is running properly

## 📈 Project Statistics

[![Star History Chart](https://api.star-history.com/svg?repos=CongtianMa/SourceNavigator&type=Date)](https://star-history.com/#CongtianMa/SourceNavigator&Date)

## 🤝 Contributing

Welcome to submit Issues and Pull Requests to the [GitHub repository](https://github.com/CongtianMa/SourceNavigator).

## 🙏 Acknowledgments

This project was inspired by and references the following excellent open-source projects:

- **[VSCode MCP](https://github.com/tjx666/vscode-mcp)** - MCP server for VSCode/Cursor/Windsurf with real-time LSP diagnostics and code navigation capabilities
- **[BifrostMCP](https://github.com/biegehydra/BifrostMCP)** - Original MCP server implementation that provided the foundation for intelligent code analysis tools

Special thanks to the maintainers and contributors of these projects for their pioneering work in the MCP ecosystem.

## 📄 License

This project is licensed under the APGL-3.0 License.
