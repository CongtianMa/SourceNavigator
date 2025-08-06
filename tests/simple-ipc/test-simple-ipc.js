const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 启动简单IPC多客户端测试...');

let serverProcess;
let clientProcesses = [];

// 启动服务器
function startServer() {
    console.log('📡 启动IPC服务器...');
    
    serverProcess = spawn('node', [path.join(__dirname, 'simple-ipc-server.js')], {
        stdio: 'inherit',
        cwd: __dirname
    });
    
    serverProcess.on('exit', (code, signal) => {
        console.log(`[服务器] 进程退出，代码: ${code}，信号: ${signal}`);
    });
    
    return new Promise(resolve => {
        setTimeout(resolve, 2000); // 等待服务器启动
    });
}

// 启动客户端
function startClient(clientId, workspaceName, workspacePath) {
    console.log(`📱 启动客户端: ${clientId}`);
    
    const clientProcess = spawn('node', [
        path.join(__dirname, 'simple-ipc-client.js'),
        clientId,
        workspaceName,
        workspacePath
    ], {
        stdio: 'inherit',
        cwd: __dirname
    });
    
    clientProcess.on('exit', (code, signal) => {
        console.log(`[${clientId}] 进程退出，代码: ${code}，信号: ${signal}`);
    });
    
    clientProcesses.push({ process: clientProcess, id: clientId });
    
    return new Promise(resolve => {
        setTimeout(resolve, 1000); // 等待客户端启动
    });
}

// 主测试函数
async function runTest() {
    try {
        // 启动服务器
        await startServer();
        
        // 启动多个客户端
        const clients = [
            { id: 'frontend_client', name: 'Frontend Project', path: '/project/frontend' },
            { id: 'backend_client', name: 'Backend API', path: '/project/backend' },
            { id: 'mobile_client', name: 'Mobile App', path: '/project/mobile' },
            { id: 'docs_client', name: 'Documentation', path: '/project/docs' }
        ];
        
        console.log(`\n🎭 启动 ${clients.length} 个客户端...`);
        
        for (const client of clients) {
            await startClient(client.id, client.name, client.path);
        }
        
        console.log('\n✅ 所有客户端已启动，观察通信...');
        console.log('💡 提示: 测试将运行30秒后自动结束，或按 Ctrl+C 手动停止\n');
        
        // 运行30秒后自动结束
        await new Promise(resolve => {
            setTimeout(() => {
                console.log('\n⏰ 测试时间到，自动结束...');
                resolve();
            }, 30000); // 30秒
        });
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 清理函数
function cleanup() {
    console.log('\n🧹 清理进程...');
    
    // 停止所有客户端
    clientProcesses.forEach(({ process, id }) => {
        console.log(`⏹️ 停止客户端: ${id}`);
        process.kill('SIGTERM');
    });
    
    // 停止服务器
    if (serverProcess) {
        console.log('⏹️ 停止服务器');
        serverProcess.kill('SIGTERM');
    }
    
    setTimeout(() => {
        console.log('🏁 测试结束');
        process.exit(0);
    }, 1000);
}

// 处理进程退出
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 运行测试
runTest().catch(console.error);