#!/usr/bin/env node

/**
 * 独立的模拟客户端进程
 * 模拟一个VSCode扩展实例连接到共享MCP服务器
 */

const { default: ipc } = require('node-ipc');

// 从命令行参数获取客户端配置
const args = process.argv.slice(2);
if (args.length < 3) {
    console.error('使用方法: node mock-client.js <clientId> <workspacePath> <workspaceName>');
    process.exit(1);
}

const [clientId, workspacePath, workspaceName] = args;

// 配置IPC客户端
ipc.config.id = clientId;
ipc.config.retry = 1500;
ipc.config.silent = true;

let isRegistered = false;
let messageCount = 0;

console.log(`🎭 [${clientId}] 启动模拟客户端进程...`);
console.log(`   工作空间: ${workspaceName} (${workspacePath})`);

// 连接到共享MCP服务器
ipc.connectTo('sharedMcpServerProcess', () => {
    
    // 连接成功
    ipc.of.sharedMcpServerProcess.on('connect', () => {
        console.log(`🔗 [${clientId}] 连接到共享MCP服务器成功`);
        
        // 发送注册请求
        const registration = {
            workspacePath,
            workspaceName,
            clientId,
            config: {
                // 模拟配置
                tools: ['file_search', 'grep_search', 'read_file'],
                port: 8000 + Math.floor(Math.random() * 1000)
            },
            pid: process.pid
        };
        
        console.log(`📝 [${clientId}] 发送客户端注册请求...`);
        ipc.of.sharedMcpServerProcess.emit('register-client', registration);
    });
    
    // 注册响应
    ipc.of.sharedMcpServerProcess.on('register-response', (data) => {
        if (data.success) {
            console.log(`✅ [${clientId}] 注册成功！`);
            isRegistered = true;
            
            // 开始发送测试消息
            startTestMessages();
        } else {
            console.error(`❌ [${clientId}] 注册失败:`, data.error);
            process.exit(1);
        }
    });
    
    // 工具调用请求
    ipc.of.sharedMcpServerProcess.on('tool-call-request', async (data) => {
        console.log(`🔧 [${clientId}] 收到工具调用请求: ${data.toolName}`);
        console.log(`   参数:`, JSON.stringify(data.args, null, 2));
        console.log(`   请求ID: ${data.requestId}`);
        
        // 模拟处理工具调用
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        const result = {
            success: true,
            data: `工具 ${data.toolName} 在 ${workspaceName} 中执行完成`,
            files: [`${workspacePath}/file1.js`, `${workspacePath}/file2.ts`],
            metadata: {
                clientId,
                workspacePath,
                executedAt: new Date().toISOString(),
                toolName: data.toolName,
                args: data.args
            }
        };
        
        // 发送响应
        ipc.of.sharedMcpServerProcess.emit('tool-call-response', {
            requestId: data.requestId,
            result
        });
        
        console.log(`📤 [${clientId}] 已回复工具调用: ${data.requestId}`);
    });
    
    // 连接断开
    ipc.of.sharedMcpServerProcess.on('disconnect', () => {
        console.log(`❌ [${clientId}] 与共享MCP服务器断开连接`);
        isRegistered = false;
    });
    
    // 错误处理
    ipc.of.sharedMcpServerProcess.on('error', (error) => {
        console.error(`🚨 [${clientId}] IPC错误:`, error.message);
    });
});

// 发送测试消息
function startTestMessages() {
    const interval = setInterval(() => {
        if (!isRegistered) {
            clearInterval(interval);
            return;
        }
        
        messageCount++;
        
        // 每5条消息发送一次广播测试
        if (messageCount % 5 === 0) {
            console.log(`📢 [${clientId}] 发送测试广播 #${messageCount}`);
            ipc.of.sharedMcpServerProcess.emit('test-broadcast', {
                clientId,
                message: `来自 ${workspaceName} 的广播消息 #${messageCount}`,
                timestamp: new Date().toISOString()
            });
        } else {
            // 发送普通测试消息
            console.log(`📨 [${clientId}] 发送测试消息 #${messageCount}`);
            ipc.of.sharedMcpServerProcess.emit('test-message', {
                clientId,
                message: `来自 ${workspaceName} 的测试消息 #${messageCount}`,
                timestamp: new Date().toISOString()
            });
        }
        
    }, 2000 + Math.random() * 2000); // 随机间隔2-4秒
}

// 优雅退出处理
process.on('SIGINT', () => {
    console.log(`\n🛑 [${clientId}] 收到退出信号，正在断开连接...`);
    
    if (isRegistered) {
        // 发送注销请求
        ipc.of.sharedMcpServerProcess.emit('unregister-client', { clientId });
    }
    
    // 断开连接
    ipc.disconnect('sharedMcpServerProcess');
    
    setTimeout(() => {
        console.log(`👋 [${clientId}] 客户端进程退出`);
        process.exit(0);
    }, 500);
});

process.on('SIGTERM', () => {
    console.log(`\n⏹️ [${clientId}] 收到终止信号，正在断开连接...`);
    
    if (isRegistered) {
        ipc.of.sharedMcpServerProcess.emit('unregister-client', { clientId });
    }
    
    ipc.disconnect('sharedMcpServerProcess');
    
    setTimeout(() => {
        console.log(`👋 [${clientId}] 客户端进程退出`);
        process.exit(0);
    }, 500);
});