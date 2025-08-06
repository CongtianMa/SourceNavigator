const { default: ipc } = require('node-ipc');

console.log('🚀 启动简单IPC服务器...');

// 配置IPC服务器
ipc.config.id = 'simpleIpcServer';
ipc.config.retry = 1500;
ipc.config.silent = true;

// 客户端注册表
const clients = new Map();

// 启动IPC服务器
ipc.serve(() => {
    console.log('📡 IPC服务器启动成功');
    
    // 监听客户端连接
    ipc.server.on('connect', (socket) => {
        console.log(`🔗 新客户端连接: ${socket.id || socket}`);
    });
    
    // 监听客户端断开
    ipc.server.on('disconnect', (socket) => {
        console.log(`❌ 客户端断开: ${socket.id || socket}`);
        
        // 由于socket.id可能不可用，我们需要通过clientId来查找和删除
        let clientToRemove = null;
        for (const [socketId, client] of clients) {
            if (socketId === socket || socketId === socket.id) {
                clientToRemove = socketId;
                break;
            }
        }
        
        if (clientToRemove) {
            const removedClient = clients.get(clientToRemove);
            clients.delete(clientToRemove);
            console.log(`🗑️ 移除客户端: ${removedClient.clientId}`);
        }
        
        console.log(`📊 当前客户端数: ${clients.size}`);
    });
    
    // 监听客户端注册
    ipc.server.on('register', (data, socket) => {
        console.log(`📝 收到注册请求来自: ${data.clientId}`);
        console.log(`   工作空间: ${data.workspaceName} (${data.workspacePath})`);
        
        // 保存客户端信息（使用socket本身作为key，因为socket.id可能为undefined）
        const socketKey = socket.id || socket;
        clients.set(socketKey, {
            socket: socket,
            socketId: socketKey,
            clientId: data.clientId,
            workspaceName: data.workspaceName,
            workspacePath: data.workspacePath,
            pid: data.pid,
            registeredAt: new Date()
        });
        
        // 发送注册成功响应
        ipc.server.emit(socket, 'register-response', {
            success: true,
            message: '注册成功',
            clientId: data.clientId
        });
        
        console.log(`✅ 客户端注册成功: ${data.clientId}`);
        console.log(`📊 当前客户端数: ${clients.size}`);
    });
    
    // 监听测试消息
    ipc.server.on('test-message', (data, socket) => {
        console.log(`📨 收到测试消息来自: ${data.clientId} - ${data.message}`);
        
        // 回复消息
        ipc.server.emit(socket, 'test-response', {
            success: true,
            reply: `服务器收到消息: ${data.message}`,
            timestamp: new Date().toISOString()
        });
    });
    
    // 监听广播请求
    ipc.server.on('broadcast-request', (data, socket) => {
        console.log(`📢 收到广播请求: ${data.message}`);
        
        // 向所有客户端广播消息
        let recipients = 0;
        const senderKey = socket.id || socket;
        
        for (const [socketKey, client] of clients) {
            if (socketKey !== senderKey) { // 不向发送者发送
                ipc.server.emit(client.socket, 'broadcast-message', {
                    from: data.clientId,
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
                recipients++;
            }
        }
        
        // 回复发送者
        ipc.server.emit(socket, 'broadcast-response', {
            success: true,
            recipients: recipients
        });
    });
});

// 启动服务器
ipc.server.start();

// 定期显示客户端状态
setInterval(() => {
    if (clients.size > 0) {
        console.log(`\n📊 当前注册的客户端 (${clients.size}个):`);
        for (const [socketId, client] of clients) {
            console.log(`   - ${client.clientId}: ${client.workspaceName} (PID: ${client.pid})`);
        }
        console.log('');
    }
}, 10000);

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭IPC服务器...');
    ipc.server.stop();
    process.exit(0);
});

console.log('✅ IPC服务器配置完成，等待客户端连接...');