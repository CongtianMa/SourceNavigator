# SourceNavigator 插件安装指南

## 📦 插件包信息

- **插件名称**: SourceNavigator - VSCode Dev Tools MCP Server
- **版本**: 0.0.13
- **文件**: `source-navigator-0.0.13.vsix` (约 4.4 MB)
- **支持的VSCode版本**: ^1.93.0

## 🚀 安装方法

### 方法 1: 通过VSCode界面安装

1. 打开VSCode
2. 按下 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (macOS) 打开命令面板
3. 输入 `Extensions: Install from VSIX...`
4. 选择 `source-navigator-0.0.13.vsix` 文件
5. 等待安装完成并重新加载VSCode

### 方法 2: 通过命令行安装

```bash
code --install-extension source-navigator-0.0.13.vsix
```

## ✨ 功能特点

### 🎯 核心功能
- **共享MCP服务器**: 多个VSCode窗口共享一个MCP服务器实例
- **智能路由**: 基于workspace_path参数的工具调用路由
- **自动管理**: 客户端自动注册/注销，服务器自动启动/停止

### 🔧 支持的工具
- `get_type_definition`: 搜索类型定义
- `read_outer_file`: 读取外部文件内容
- 更多工具正在开发中...

### 🌐 服务器信息
- **默认端口**: 8010
- **健康检查**: `http://localhost:8010/health`
- **客户端状态**: `http://localhost:8010/clients`

## 📋 使用方法

### 1. 基本使用
插件安装后会自动启动，每个VSCode窗口会自动注册为客户端。

### 2. 多窗口支持
- 打开多个VSCode窗口
- 每个窗口会自动注册到共享MCP服务器
- AI工具调用可以通过`workspace_path`参数指定目标窗口

### 3. 工具调用示例
```json
{
  "name": "read_outer_file",
  "arguments": {
    "target_file": "package.json",
    "workspace_path": "/path/to/specific/workspace"
  }
}
```

## 🎛️ 命令

插件提供以下VSCode命令：

- `SourceNavigator: Start Server` - 启动MCP服务器
- `SourceNavigator: Stop Server` - 停止MCP服务器  
- `SourceNavigator: Open Debug Panel` - 打开调试面板

## 🔧 配置

在工作区根目录创建 `source-navigator.config.json` 文件：

```json
{
    "projectName": "my-project",
    "description": "项目描述",
    "path": "/api/v1",
    "port": 8010
}
```

## 🐛 故障排除

### 常见问题

1. **端口被占用**
   - 检查端口8010是否被其他程序占用
   - 修改配置文件中的端口号

2. **服务器启动失败**
   - 查看VSCode输出面板中的错误信息
   - 尝试重新启动VSCode

3. **客户端连接失败**
   - 确保服务器正在运行
   - 检查IPC连接状态

### 调试方法

1. 打开VSCode开发者工具: `Help > Toggle Developer Tools`
2. 查看Console面板中的日志信息
3. 使用`SourceNavigator: Open Debug Panel`命令查看详细状态

## 📝 更新日志

### v0.0.13
- ✅ 实现共享MCP服务器架构
- ✅ 支持多窗口VSCode环境
- ✅ 添加workspace路由功能
- ✅ 改进错误处理和日志记录
- ✅ 优化资源管理和进程生命周期

## 🤝 支持

如有问题或建议，请联系：
- GitHub: https://github.com/macongtian/SourceNavigator
- 提交Issue或Pull Request

## 📄 许可证

本项目采用开源许可证，详见LICENSE文件。