const { default: ipc } = require('node-ipc');

// 从命令行参数获取客户端ID
const clientId = process.argv[2] || `client_${Date.now()}`;
const workspaceName = process.argv[3] || `Workspace_${clientId}`;
const workspacePath = process.argv[4] || `/project/${clientId}`;

console.log(`🎭 启动IPC客户端: ${clientId}`);

// 配置IPC客户端
ipc.config.id = clientId;
ipc.config.retry = 1500;
ipc.config.silent = true;

let isConnected = false;

// 连接到服务器
ipc.connectTo('simpleIpcServer', () => {
    
    ipc.of.simpleIpcServer.on('connect', () => {
        console.log(`[${clientId}] ✅ 连接到IPC服务器成功`);
        isConnected = true;
        
        // 发送注册请求
        registerClient();
        
        // 设置事件监听器
        setupEventHandlers();
        
        // 定期发送测试消息
        startTestMessages();
    });
    
    ipc.of.simpleIpcServer.on('disconnect', () => {
        console.log(`[${clientId}] ❌ 与IPC服务器断开连接`);
        isConnected = false;
    });
    
    ipc.of.simpleIpcServer.on('error', (error) => {
        console.error(`[${clientId}] IPC连接错误:`, error.message);
    });
});

// 注册客户端
function registerClient() {
    const registration = {
        clientId: clientId,
        workspaceName: workspaceName,
        workspacePath: workspacePath,
        pid: process.pid,
        capabilities: ['file-operations', 'code-analysis']
    };
    
    console.log(`[${clientId}] 发送注册请求...`);
    ipc.of.simpleIpcServer.emit('register', registration);
}

// 设置事件处理器
function setupEventHandlers() {
    // 监听注册响应
    ipc.of.simpleIpcServer.on('register-response', (data) => {
        if (data.success) {
            console.log(`[${clientId}] 🎉 注册成功: ${data.message}`);
        } else {
            console.error(`[${clientId}] ❌ 注册失败: ${data.error}`);
        }
    });
    
    // 监听测试响应
    ipc.of.simpleIpcServer.on('test-response', (data) => {
        console.log(`[${clientId}] 📨 收到服务器回复: ${data.reply}`);
    });
    
    // 监听广播消息
    ipc.of.simpleIpcServer.on('broadcast-message', (data) => {
        console.log(`[${clientId}] 📢 收到广播来自 ${data.from}: ${data.message}`);
    });
    
    // 监听广播响应
    ipc.of.simpleIpcServer.on('broadcast-response', (data) => {
        if (data.success) {
            console.log(`[${clientId}] 📢 广播发送成功，接收者: ${data.recipients}个`);
        }
    });
}

// 发送测试消息
function startTestMessages() {
    let messageCount = 0;
    
    setInterval(() => {
        if (isConnected) {
            messageCount++;
            
            // 每5条消息发送一次广播
            if (messageCount % 5 === 0) {
                ipc.of.simpleIpcServer.emit('broadcast-request', {
                    clientId: clientId,
                    message: `广播消息 #${messageCount} 来自 ${clientId}`
                });
            } else {
                // 发送普通测试消息
                ipc.of.simpleIpcServer.emit('test-message', {
                    clientId: clientId,
                    message: `测试消息 #${messageCount}`,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }, 3000 + Math.random() * 2000); // 3-5秒随机间隔
}

// 优雅关闭
process.on('SIGINT', () => {
    console.log(`\n[${clientId}] 🛑 正在断开连接...`);
    if (isConnected) {
        ipc.disconnect('simpleIpcServer');
    }
    process.exit(0);
});

console.log(`[${clientId}] 正在连接到IPC服务器...`);