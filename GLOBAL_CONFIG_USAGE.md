# SourceNavigator 全局配置使用说明

## 概述

SourceNavigator 现在支持使用全局配置来统一管理共享服务器的端口和路径设置，而不需要在每个项目中单独配置这些参数。

## 配置方法

### 方法1：通过 VSCode 设置界面

1. 打开 VSCode 设置 (Ctrl/Cmd + ,)
2. 搜索 "SourceNavigator"
3. 配置以下选项：
   - **SourceNavigator: Port**: 共享MCP服务器端口号 (默认: 8010)
   - **SourceNavigator: Path**: 服务器路径前缀 (默认: "")

### 方法2：通过 settings.json 文件

在 VSCode 的 `settings.json` 文件中添加：

```json
{
  "sourceNavigator.port": 8010,
  "sourceNavigator.path": ""
}
```

## 配置说明

### sourceNavigator.port
- **类型**: 数字
- **默认值**: 8010
- **描述**: 共享MCP服务器使用的端口号
- **示例**: 
  ```json
  "sourceNavigator.port": 9000
  ```

### sourceNavigator.path
- **类型**: 字符串
- **默认值**: ""
- **描述**: 服务器路径前缀，如果需要在特定路径下提供服务
- **示例**: 
  ```json
  "sourceNavigator.path": "/api/mcp"
  ```

## 工作原理

1. **全局优先**: 系统首先读取全局VSCode设置中的配置
2. **项目配置简化**: `source-navigator.config.json` 文件现在只需要配置项目特定的信息：
   ```json
   {
     "projectName": "my-project",
     "description": "我的项目描述"
   }
   ```
3. **自动合并**: 系统会自动将全局配置的端口和路径与项目配置合并

## 迁移指南

如果您之前在项目的 `source-navigator.config.json` 文件中配置了端口和路径：

**之前的配置**:
```json
{
  "projectName": "my-project",
  "description": "我的项目描述",
  "port": 8010,
  "path": ""
}
```

**现在的配置**:

1. VSCode 全局设置:
   ```json
   {
     "sourceNavigator.port": 8010,
     "sourceNavigator.path": ""
   }
   ```

2. 项目配置文件:
   ```json
   {
     "projectName": "my-project",
     "description": "我的项目描述"
   }
   ```

## 优势

1. **统一管理**: 所有项目使用相同的端口和路径配置
2. **简化配置**: 项目配置文件更简洁，只关注项目特定信息
3. **共享服务器**: 支持多个VSCode窗口共享同一个MCP服务器实例
4. **动态更新**: 修改全局配置后，重启扩展即可生效

## 注意事项

- 更改端口配置后，需要重启SourceNavigator扩展才能生效
- 如果端口被其他应用占用，扩展会自动检测并提示错误
- 建议使用默认端口8010，除非有特殊需求