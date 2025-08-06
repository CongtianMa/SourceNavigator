# SourceNavigator 全局配置使用说明

## 概述

SourceNavigator 现在采用简化的全局配置方式，使用共享服务器架构，不再需要项目特定的配置文件。

## 配置方法

### 方法1：通过 VSCode 设置界面

1. 打开 VSCode 设置 (Ctrl/Cmd + ,)
2. 搜索 "SourceNavigator"
3. 配置以下选项：
   - **SourceNavigator: Port**: 共享MCP服务器端口号 (默认: 8010)

### 方法2：通过 settings.json 文件

在 VSCode 的 `settings.json` 文件中添加：

```json
{
  "sourceNavigator.port": 8010
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

## 工作原理

1. **共享服务器**: 使用全局唯一的共享MCP服务器实例
2. **自动检测**: 系统自动从VSCode工作区获取项目信息
3. **无配置文件**: 不再需要项目特定的配置文件

## 迁移指南

如果您之前使用了项目配置文件：

**之前的配置文件 (`source-navigator.config.json`)**:
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
     "sourceNavigator.port": 8010
   }
   ```

2. 删除项目配置文件:
   - 可以安全删除所有 `source-navigator.config.json` 文件
   - 项目信息现在自动从VSCode工作区获取

## 优势

1. **零配置**: 无需创建和维护项目配置文件
2. **统一管理**: 所有项目使用相同的端口配置
3. **共享服务器**: 支持多个VSCode窗口共享同一个MCP服务器实例
4. **自动化**: 项目信息自动从VSCode工作区获取
5. **简化维护**: 减少配置文件管理的复杂性

## 注意事项

- 更改端口配置后，需要重启SourceNavigator扩展才能生效
- 如果端口被其他应用占用，扩展会自动检测并提示错误
- 建议使用默认端口8010，除非有特殊需求