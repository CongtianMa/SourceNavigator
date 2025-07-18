# SourceNavigator - VSCode Dev Tools MCP Server
<a href="https://marketplace.visualstudio.com/items?itemName=ConnorHallman.source-navigator">
  <img src="https://img.shields.io/visual-studio-marketplace/d/ConnorHallman.source-navigator?label=VSCode%20Extension%20Downloads&cacheSeconds=3600" 
       alt="VSCode Extension Downloads" 
       width="250">
</a>

This VS Code extension provides a Model Context Protocol (MCP) server that offers intelligent code navigation and analysis tools for AI assistants. It enables advanced source code understanding, type definition exploration, and external file analysis capabilities when using AI coding assistants that support the MCP protocol.

![image](https://raw.githubusercontent.com/macongtian/SourceNavigator/refs/heads/master/src/images/cursor.png)

## Table of Contents
- [Features](#features)
- [Installation/Usage](#usage)
- [Multi-Project Support](#multiple-project-support)
- [Available Tools](#available-tools)
- [Installation](#installation)
- [Available Commands](#available-commands)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Debugging](#debugging)
- [License](#license)

## Features

- **Type Definition Analysis**: Intelligent search and analysis of type definitions across the workspace
- **External File Reading**: Read and analyze external dependencies, configuration files, and project documents
- **Advanced Code Navigation**: Deep understanding of code structure and relationships
- **AI-Optimized Tools**: Tools specifically designed for AI assistant workflows
- **HTTP/SSE Server**: Exposes analysis capabilities over an MCP-compatible HTTP server
- **Multi-Project Support**: Dedicated endpoints and ports for different projects

## Usage

### Installation

1. Install [the extension](https://marketplace.visualstudio.com/items?itemName=ConnorHallman.source-navigator) from the VS Code marketplace
2. Install any language-specific extensions you need for your development
3. Open your project in VS Code

### Configuration

The extension will automatically start an MCP server when activated. To configure an AI assistant to use this server:

1. The server runs on port 8008 by default (configurable with `source-navigator.config.json`)
2. Configure your MCP-compatible AI assistant to connect to:
   - SSE endpoint: `http://localhost:8008/sse`
   - Message endpoint: `http://localhost:8008/message`

### LLM Rules
I have also provided sample rules that can be used in .cursorrules files for better results.

[Example Cursor Rules](https://github.com/macongtian/SourceNavigator/blob/master/ExampleCursorRules.md)

[Example MDC Rules](https://github.com/macongtian/SourceNavigator/blob/master/example.mdc)

### Cline Installation
- Step 1. Install [Supergateway](https://github.com/supercorp-ai/supergateway)
- Step 2. Add config to cline
- Step 3. It will show up red but seems to work fine

#### Windows Config
```json
{
  "mcpServers": {
    "SourceNavigator": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "supergateway",
        "--sse",
        "http://localhost:8008/sse"
      ],
      "disabled": false,
      "autoApprove": [],
      "timeout": 600
    }
  }
}
```

#### Mac/Linux Config
```json
{
  "mcpServers": {
    "SourceNavigator": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "http://localhost:8008/sse"
      ],
      "disabled": false,
      "autoApprove": [],
      "timeout": 600
    }
  }
}
```

### Roo Code Installation
- Step 1: Add the SSE config to your global or project-based MCP configuration
```json
{
  "mcpServers": {
    "SourceNavigator": {
      "url": "http://localhost:8008/sse"
    }
  }
}
```

![Screenshot_78](https://github.com/user-attachments/assets/55588c9e-7f88-4830-b87f-184018873ca1)

Follow this video to install and use with cursor

#### FOR NEW VERSIONS OF CURSOR, USE THIS CODE
```json
{
  "mcpServers": {
    "SourceNavigator": {
      "url": "http://localhost:8008/sse"
    }
  }
}
```

## Multiple Project Support

When working with multiple projects, each project can have its own dedicated MCP server endpoint and port. This is useful when you have multiple VS Code windows open or are working with multiple projects that need language server capabilities.

### Project Configuration

Create a `source-navigator.config.json` file in your project root:

```json
{
    "projectName": "MyProject",
    "description": "Description of your project",
    "path": "/my-project",
    "port": 5642
}
```

The server will use this configuration to:
- Create project-specific endpoints (e.g., `http://localhost:5642/my-project/sse`)
- Provide project information to AI assistants
- Use a dedicated port for each project
- Isolate project services from other running instances

### Example Configurations

1. Backend API Project:
```json
{
    "projectName": "BackendAPI",
    "description": "Node.js REST API with TypeScript",
    "path": "/backend-api",
    "port": 5643
}
```

2. Frontend Web App:
```json
{
    "projectName": "FrontendApp",
    "description": "React frontend application",
    "path": "/frontend-app",
    "port": 5644
}
```

### Port Configuration

Each project should specify its own unique port to avoid conflicts when multiple VS Code instances are running:

- The `port` field in `source-navigator.config.json` determines which port the server will use
- If no port is specified, it defaults to 8008 for backwards compatibility
- Choose different ports for different projects to ensure they can run simultaneously
- The server will fail to start if the configured port is already in use, requiring you to either:
  - Free up the port
  - Change the port in the config
  - Close the other VS Code instance using that port

### Connecting to Project-Specific Endpoints

Update your AI assistant configuration to use the project-specific endpoint and port:

```json
{
  "mcpServers": {
    "BackendAPI": {
      "url": "http://localhost:5643/backend-api/sse"
    },
    "FrontendApp": {
      "url": "http://localhost:5644/frontend-app/sse"
    }
  }
}
```

### Backwards Compatibility

If no `source-navigator.config.json` is present, the server will use the default configuration:
- Port: 8008
- SSE endpoint: `http://localhost:8008/sse`
- Message endpoint: `http://localhost:8008/message`

This maintains compatibility with existing configurations and tools.

## Available Tools

The extension provides intelligent code analysis and navigation tools:

* **get\_type\_definition**: Find and analyze type definitions across the workspace with intelligent search capabilities.
* **read\_outer\_file**: Read external files, dependencies, and configuration files with support for various URI formats and line range specifications.

## Requirements

- Visual Studio Code version 1.93.0 or higher
- Appropriate language extensions for the languages you want to work with (e.g., C# extension for C# files)

### Available Commands

- `SourceNavigator: Start Server` - Manually start the MCP server on port 8008
- `SourceNavigator: Start Server on Port` - Manually start the MCP server on specified port
- `SourceNavigator: Stop Server` - Stop the running MCP server
- `SourceNavigator: Open Debug Panel` - Open the debug panel to test available tools

![image](https://raw.githubusercontent.com/macongtian/SourceNavigator/refs/heads/master/src/images/commands.png)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=macongtian/SourceNavigator&type=Date)](https://star-history.com/#macongtian/SourceNavigator&Date)

## Example Tool Usage

### Type Definition Search
```json
{
  "name": "get_type_definition",
  "arguments": {
    "name": "MyClass"
  }
}
```

### External File Reading
```json
{
  "name": "read_outer_file",
  "arguments": {
    "target_file": "file:///path/to/your/file",
    "should_read_entire_file": false,
    "start_line_one_indexed": 1,
    "end_line_one_indexed_inclusive": 50
  }
}
```

## Troubleshooting

If you encounter issues:

1. Ensure you have the appropriate language extensions installed for your project
2. Check that your project has loaded correctly in VSCode
3. Verify that port 8008 is available on your system
4. Check the VSCode output panel for any error messages

## Contributing
This project is based on the original Bifrost MCP server but has been significantly modified to focus on intelligent code navigation and analysis tools. Please feel free to submit issues or pull requests to the [GitHub repository](https://github.com/macongtian/SourceNavigator).

`vsce package`

## Debugging
Use the `MCP: Open Debug Panel` command
![image](https://raw.githubusercontent.com/macongtian/SourceNavigator/refs/heads/master/src/images/debug_panel.png)

## License

This extension is licensed under the APGL-3.0 License.
