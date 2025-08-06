# SourceNavigator 测试指南

## 🧪 快速测试

### 诊断多窗口问题
```bash
node tests/run-tests.js diagnose
```

### 测试多客户端功能
```bash
node tests/run-tests.js multi-client
```

### 简单窗口连接测试
```bash
node tests/run-tests.js multi-window
```

## 📋 常见问题解决

### "端口 8010 已被其他进程占用"
1. 运行诊断工具：`node tests/run-tests.js diagnose`
2. 按照诊断建议清理进程和锁文件
3. 重新编译：`npm run compile`

### 多个VSCode窗口无法共享服务器
1. 关闭所有VSCode窗口
2. 清理环境：`kill -9 $(lsof -ti:8010) 2>/dev/null; rm -f /tmp/source-navigator-server.lock`
3. 重新编译：`npm run compile`
4. 重新打开VSCode窗口

## 📂 详细文档

查看 `tests/README.md` 了解完整的测试架构和说明。