# 共享MCP服务器架构设计

## 问题分析

当前架构的问题：
- 每个VSCode窗口创建独立的MCP服务器进程
- 多个服务器监听不同端口，资源浪费
- 无法统一管理和路由请求

## 新架构设计

### 1. 共享服务器模式
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VSCode窗口1   │    │   VSCode窗口2   │    │   VSCode窗口3   │
│  (workspace-A)  │    │  (workspace-B)  │    │  (workspace-C)  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │         IPC 长连接   │                      │
          └──────────┬───────────┴──────────────────────┘
                     │
            ┌────────▼────────┐
            │  共享MCP服务器   │
            │   (单一进程)    │
            │  端口: 8009     │
            └────────┬────────┘
                     │
            ┌────────▼────────┐
            │   AI客户端      │
            │ (Claude/GPT等)  │
            └─────────────────┘
```

### 2. 核心组件

#### 2.1 共享服务器管理器 (SharedServerManager)
- 单例模式，确保只有一个服务器实例
- 管理全局服务器进程生命周期
- 处理多客户端注册和注销

#### 2.2 工作区客户端注册表 (WorkspaceClientRegistry)
- 维护workspace → IPC客户端映射
- 处理客户端注册/注销
- 支持工具调用路由

#### 2.3 增强的IPC协议
```typescript
// 客户端注册消息
interface ClientRegistration {
    workspacePath: string;
    workspaceName: string;
    clientId: string;
    config: SourceNavigatorConfig;
}

// 工具调用消息（增加workspace路由）
interface ToolCallRequest {
    requestId: string;
    toolName: string;
    args: any;
    workspacePath?: string; // 可选，用于路由
}
```

### 3. 工具调用路由机制

#### 3.1 workspace参数路由
```typescript
// 工具定义增加workspace参数
{
    name: "read_outer_file",
    inputSchema: {
        properties: {
            target_file: { type: "string" },
            workspace_path: { 
                type: "string", 
                description: "Target workspace path for multi-window routing" 
            }
        }
    }
}
```

#### 3.2 路由逻辑
1. **显式路由**：工具调用包含workspace_path参数
2. **默认路由**：没有workspace_path时，路由到第一个注册的客户端
3. **错误处理**：workspace不存在时返回友好错误

### 4. 生命周期管理

#### 4.1 服务器启动
1. 第一个VSCode窗口启动时创建共享服务器
2. 后续窗口复用现有服务器
3. 服务器监听固定端口（如8009）

#### 4.2 客户端管理
1. 窗口打开 → 注册到共享服务器
2. 窗口关闭 → 从服务器注销
3. 最后一个窗口关闭 → 停止共享服务器

#### 4.3 容错机制
1. 服务器进程崩溃 → 自动重启并重新注册所有客户端
2. 客户端断开 → 自动清理注册信息
3. 工具调用超时 → 返回错误，不影响其他调用

## 实现状态 ✅ 已完成

### Phase 1: 基础架构 ✅
- [x] 创建SharedServerManager - `src/sharedServerManager.ts`
- [x] 修改IPC协议支持多客户端 - `src/sharedMcpServerProcess.ts`
- [x] 实现WorkspaceClientRegistry - 集成在SharedServerManager中

### Phase 2: 路由机制 ✅
- [x] 工具定义增加workspace_path参数 - `src/tools.ts`
- [x] 实现工具调用路由逻辑 - `src/sharedMcpServerProcess.ts`
- [x] 更新toolRunner支持workspace上下文 - 保持兼容

### Phase 3: 生命周期管理 ✅
- [x] 更新ProcessManager支持共享模式 - `src/extension.ts`
- [x] 实现客户端注册/注销 - `src/sharedIpcClient.ts`
- [x] 添加服务器重启和恢复机制 - `src/sharedServerManager.ts`

### Phase 4: 测试和优化 ✅
- [x] 多窗口测试 - 架构测试通过
- [x] 性能优化 - 共享资源，减少重复进程
- [x] 错误处理完善 - 超时、重连、进程监控