# SourceNavigator 测试套件

这个目录包含了 SourceNavigator 扩展的测试脚本，按功能分类组织。

## 📁 目录结构

```
tests/
├── README.md                    # 本文件
├── diagnostic/                  # 诊断工具
│   └── diagnose-multi-window.js # 多窗口问题诊断工具
├── simple-ipc/                 # 基础IPC通信测试
│   ├── simple-ipc-server.js    # 简单IPC服务器
│   ├── simple-ipc-client.js    # 简单IPC客户端
│   └── test-simple-ipc.js      # IPC通信可行性测试
└── multi-client/                # 多客户端和多窗口测试
    ├── mock-client.js           # 模拟客户端进程
    ├── test-shared-multi-clients.js  # 完整的多客户端测试（推荐使用）
    ├── test-simple-multi-window.js   # 简化的多窗口测试
    ├── test-multi-clients.js         # 旧版多客户端测试
    ├── test-multi-window-connection.js  # 窗口连接测试
    └── test-shared-server.js          # 大型综合测试（待废弃）
```

## 🚀 快速开始

### 诊断多窗口问题

如果遇到"端口被占用"错误或多窗口连接问题：

```bash
node tests/diagnostic/diagnose-multi-window.js
```

### 测试多客户端功能

验证多个VSCode窗口共享同一个MCP服务器：

```bash
# 推荐：完整的多客户端测试
node tests/multi-client/test-shared-multi-clients.js

# 简化：只测试窗口连接
node tests/multi-client/test-simple-multi-window.js
```

### 测试基础IPC通信

验证node-ipc库的多客户端通信能力：

```bash
node tests/simple-ipc/test-simple-ipc.js
```

## 📋 测试脚本说明

### 推荐使用的测试脚本

1. **`diagnose-multi-window.js`** ⭐
   - 全面的问题诊断工具
   - 检查端口占用、锁文件、服务器状态
   - 提供详细的解决方案建议

2. **`test-shared-multi-clients.js`** ⭐
   - 完整的多客户端测试
   - 包含工具调用路由测试
   - 模拟真实的VSCode窗口场景

3. **`test-simple-multi-window.js`** ⭐
   - 简化的多窗口连接测试
   - 专注于服务器检测和复用逻辑
   - 快速验证核心功能

### 实验性/旧版测试脚本

- `test-shared-server.js` - 大型综合测试，功能重复，建议使用上述推荐脚本
- `test-multi-clients.js` - 旧版多客户端测试，存在全局IPC冲突问题
- `test-multi-window-connection.js` - 早期的窗口连接测试

### 基础验证脚本

- `test-simple-ipc.js` - 验证node-ipc库的基本功能
- `simple-ipc-server.js` / `simple-ipc-client.js` - 独立的IPC通信验证

## 🔧 使用建议

1. **开发过程中**：使用 `test-shared-multi-clients.js` 进行全面测试
2. **遇到问题时**：优先运行 `diagnose-multi-window.js` 进行诊断
3. **快速验证**：使用 `test-simple-multi-window.js` 检查基本功能
4. **基础调试**：使用 `test-simple-ipc.js` 验证IPC通信

## 🧹 清理说明

- 保留了主要的功能测试脚本
- 移除了重复和过时的文件
- 按功能分类整理，便于维护和查找

## 📝 注意事项

- 运行测试前确保已编译: `npm run compile`
- 测试可能需要停止现有的服务器进程
- 某些测试会自动清理资源，某些需要手动清理
- 如果测试失败，请查看VSCode输出面板的详细错误信息