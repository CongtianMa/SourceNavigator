# Source Navigator 项目总结

## 项目概述

Source Navigator 是一个基于 VSCode 语言服务器的 MCP (Model Context Protocol) 服务器，参考了 BifrostMCP 项目的架构和功能。该项目旨在为 AI 助手提供强大的代码导航和分析能力。

## 项目结构

```
SourceNavigator/
├── src/                    # 源代码目录
│   ├── extension.ts        # 主要扩展入口文件
│   ├── tools.ts           # MCP 工具定义
│   ├── toolRunner.ts      # 工具运行器实现
│   ├── config.ts          # 配置管理
│   ├── globals.ts         # 全局变量管理
│   ├── debugPanel.ts      # 调试面板
│   ├── helpers.ts         # 辅助函数
│   └── test/              # 测试文件
│       └── test.ts        # 示例测试文件
├── dist/                  # 构建输出目录
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
├── webpack.config.js      # Webpack 配置
├── eslint.config.mjs      # ESLint 配置
├── README.md              # 项目说明
├── example-usage.ts       # 使用示例
└── example.source-navigator.config.json  # 示例配置文件
```

## 核心功能

### 1. MCP 服务器
- 基于 `@modelcontextprotocol/sdk` 实现
- 支持 SSE (Server-Sent Events) 传输
- 提供 HTTP 端点用于 AI 助手连接

### 2. 代码导航工具
- **find_usages**: 查找符号的所有引用
- **go_to_definition**: 跳转到符号定义
- **get_hover_info**: 获取悬停信息
- **get_document_symbols**: 获取文档符号
- **get_workspace_symbols**: 搜索工作区符号

### 3. 多项目支持
- 每个项目可以有独立的配置
- 支持自定义端口和路径
- 项目隔离，避免冲突

### 4. 调试面板
- 内置 WebView 调试界面
- 实时测试工具功能
- 服务器状态监控

## 技术特点

### 1. 使用 VSCode 原生 API
- 直接使用 `vscode.commands.executeCommand` 调用语言服务器
- 无需复杂的语言客户端管理
- 更好的兼容性和稳定性

### 2. 中文界面和文档
- 所有用户界面和文档都使用中文
- 符合中文用户的使用习惯
- 详细的错误信息和提示

### 3. 模块化设计
- 清晰的模块分离
- 易于维护和扩展
- 良好的代码组织结构

## 配置说明

### 项目配置文件
```json
{
    "projectName": "MyProject",
    "description": "项目描述",
    "path": "/my-project",
    "port": 8009
}
```

### AI 助手配置
```json
{
  "mcpServers": {
    "SourceNavigator": {
      "url": "http://localhost:8009/source-navigator/sse"
    }
  }
}
```

## 构建和部署

### 开发环境
```bash
npm install
npm run compile
npm run watch
```

### 生产构建
```bash
npm run package
```

### 调试
- 按 F5 启动调试会话
- 使用调试面板测试功能
- 查看控制台输出

## 与 BifrostMCP 的对比

### 相似之处
- 基于 MCP 协议
- 提供代码导航功能
- 支持多项目配置
- 使用 Express 服务器

### 改进之处
- 使用 VSCode 原生 API 而非语言客户端
- 中文界面和文档
- 更简洁的架构
- 更好的错误处理

### 功能差异
- Source Navigator 专注于核心导航功能
- BifrostMCP 提供更多高级功能
- Source Navigator 更适合学习和定制

## 使用场景

1. **AI 代码助手**: 为 AI 助手提供代码理解能力
2. **代码分析**: 快速分析代码结构和依赖关系
3. **重构支持**: 安全地进行代码重构
4. **学习工具**: 帮助理解大型代码库

## 未来发展方向

1. **更多语言支持**: 扩展对更多编程语言的支持
2. **高级分析**: 添加代码复杂度、依赖分析等功能
3. **可视化界面**: 提供更丰富的可视化界面
4. **性能优化**: 优化大型项目的处理性能
5. **插件系统**: 支持第三方插件扩展功能

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License 