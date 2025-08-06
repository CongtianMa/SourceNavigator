#!/usr/bin/env node

/**
 * 测试共享MCP服务器的多客户端支持
 * 使用独立进程模拟多个VSCode实例
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

console.log('🧪 启动共享MCP服务器多客户端测试...');

// 测试配置
const TEST_DURATION = 45000; // 45秒测试时间
const mockClients = [
    { id: 'frontend_client', path: '/project/frontend', name: 'Frontend Project' },
    { id: 'backend_client', path: '/project/backend', name: 'Backend API' },
    { id: 'mobile_client', path: '/project/mobile', name: 'Mobile App' },
    { id: 'docs_client', path: '/project/docs', name: 'Documentation' },
];

let serverProcess = null;
let clientProcesses = [];
let testStartTime = null;

/**
 * 启动共享MCP服务器
 */
async function startSharedServer() {
    console.log('🚀 启动共享MCP服务器...');
    
    return new Promise((resolve, reject) => {
        // 检查是否已编译
        const serverPath = path.join(__dirname, 'dist', 'sharedMcpServerProcess.js');
        
        serverProcess = spawn('node', [serverPath], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        let outputBuffer = '';
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            outputBuffer += output;
            process.stdout.write(output);
            
            // 检查服务器是否启动成功
            if (output.includes('IPC服务器启动')) {
                console.log('✅ 共享MCP服务器启动成功');
                resolve();
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
        
        serverProcess.on('error', (error) => {
            console.error('❌ 服务器启动失败:', error.message);
            reject(error);
        });
        
        serverProcess.on('exit', (code, signal) => {
            console.log(`🔄 共享MCP服务器进程退出 (code: ${code}, signal: ${signal})`);
        });
        
        // 启动超时
        setTimeout(() => {
            if (!outputBuffer.includes('IPC服务器启动')) {
                reject(new Error('共享MCP服务器启动超时'));
            }
        }, 10000);
    });
}

/**
 * 启动模拟客户端进程
 */
async function startMockClients() {
    console.log(`\n🎭 启动 ${mockClients.length} 个模拟客户端进程...`);
    
    for (const client of mockClients) {
        console.log(`📱 启动客户端: ${client.id} (${client.name})`);
        
        const clientProcess = spawn('node', [
            'mock-client.js',
            client.id,
            client.path,
            client.name
        ], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        // 添加客户端标识
        clientProcess.clientId = client.id;
        
        clientProcess.stdout.on('data', (data) => {
            process.stdout.write(data);
        });
        
        clientProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
        
        clientProcess.on('error', (error) => {
            console.error(`❌ 客户端 ${client.id} 启动失败:`, error.message);
        });
        
        clientProcess.on('exit', (code, signal) => {
            console.log(`📱 客户端 ${client.id} 进程退出 (code: ${code}, signal: ${signal})`);
        });
        
        clientProcesses.push(clientProcess);
        
        // 延时启动，避免并发冲突
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ 所有模拟客户端已启动');
}

/**
 * 检查服务器状态
 */
async function checkServerStatus() {
    try {
        const response = await fetch('http://localhost:8010/health');
        const data = await response.json();
        console.log('\n📊 服务器健康状态:', data);
        return data;
    } catch (error) {
        console.error('❌ 检查服务器状态失败:', error.message);
        return null;
    }
}

/**
 * 检查注册的客户端
 */
async function checkRegisteredClients() {
    try {
        const response = await fetch('http://localhost:8010/clients');
        const data = await response.json();
        console.log('\n👥 已注册的客户端:');
        console.log(`   客户端数量: ${data.clients?.length || 0}`);
        
        if (data.clients && data.clients.length > 0) {
            data.clients.forEach(client => {
                console.log(`   - ${client.clientId}: ${client.workspaceName} (PID: ${client.pid})`);
            });
        }
        
        return data;
    } catch (error) {
        console.error('❌ 检查客户端状态失败:', error.message);
        return null;
    }
}

/**
 * 测试工具调用路由（通过直接IPC模拟）
 */
async function testToolCallRouting() {
    console.log('\n🔧 测试工具调用路由（IPC模拟）...');
    
    try {
        const { default: ipc } = require('node-ipc');
        
        // 配置测试客户端
        ipc.config.id = 'test_tool_caller';
        ipc.config.retry = 1500;
        ipc.config.silent = true;
        
        console.log('🔗 连接到共享MCP服务器...');
        
        // 连接到共享服务器
        ipc.connectTo('sharedMcpServerProcess', () => {
            
            ipc.of.sharedMcpServerProcess.on('connect', async () => {
                console.log('✅ 测试客户端连接成功');
                
                // 等待一下确保稳定
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // 测试1: 不指定workspace的工具调用（应该路由到第一个客户端）
                console.log('📤 测试1: 默认工具调用...');
                const testRequest1 = {
                    requestId: 'test-' + Date.now(),
                    toolName: 'file_search',
                    args: { query: 'test.js' }
                };
                
                ipc.of.sharedMcpServerProcess.emit('test-tool-call', testRequest1);
                
                // 等待一下
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // 测试2: 指定workspace的工具调用
                const targetWorkspace = mockClients[1]; // backend_client
                console.log(`📤 测试2: 路由到 ${targetWorkspace.name} 的工具调用...`);
                const testRequest2 = {
                    requestId: 'test-' + (Date.now() + 1),
                    toolName: 'grep_search',
                    args: { 
                        query: 'function',
                        workspace_path: targetWorkspace.path
                    }
                };
                
                ipc.of.sharedMcpServerProcess.emit('test-tool-call', testRequest2);
                
                // 等待响应
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 断开连接
                ipc.disconnect('sharedMcpServerProcess');
                console.log('🔌 工具调用测试完成，已断开连接');
            });
            
            ipc.of.sharedMcpServerProcess.on('test-tool-response', (data) => {
                console.log(`✅ 收到工具调用响应:`, {
                    requestId: data.requestId,
                    success: data.result?.success,
                    data: data.result?.data,
                    from: data.result?.metadata?.clientId
                });
            });
            
            ipc.of.sharedMcpServerProcess.on('error', (error) => {
                console.error('❌ 测试客户端连接错误:', error.message);
            });
        });
        
        // 等待测试完成
        await new Promise(resolve => setTimeout(resolve, 8000));
        
    } catch (error) {
        console.error('❌ 工具调用测试失败:', error.message);
    }
}

/**
 * 定期状态检查
 */
function startStatusMonitoring() {
    const statusInterval = setInterval(async () => {
        if (!testStartTime) return;
        
        const elapsed = Date.now() - testStartTime;
        const remaining = Math.max(0, TEST_DURATION - elapsed);
        
        console.log(`\n⏱️  测试运行时间: ${Math.floor(elapsed/1000)}s, 剩余: ${Math.floor(remaining/1000)}s`);
        
        await checkRegisteredClients();
        
        if (remaining <= 0) {
            clearInterval(statusInterval);
        }
    }, 15000); // 每15秒检查一次
}

/**
 * 清理进程
 */
function cleanup() {
    console.log('\n🧹 正在清理进程...');
    
    // 停止客户端进程
    clientProcesses.forEach(process => {
        if (process && !process.killed) {
            console.log(`⏹️ 停止客户端: ${process.clientId}`);
            process.kill('SIGTERM');
        }
    });
    
    // 停止服务器进程
    if (serverProcess && !serverProcess.killed) {
        console.log('⏹️ 停止共享MCP服务器');
        serverProcess.kill('SIGTERM');
    }
    
    // 强制清理
    setTimeout(() => {
        clientProcesses.forEach(process => {
            if (process && !process.killed) {
                process.kill('SIGKILL');
            }
        });
        
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL');
        }
    }, 3000);
}

/**
 * 主测试函数
 */
async function runTest() {
    try {
        // 启动共享MCP服务器
        await startSharedServer();
        
        // 等待服务器完全启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 检查服务器状态
        await checkServerStatus();
        
        // 启动模拟客户端
        await startMockClients();
        
        // 等待客户端注册
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 检查注册状态
        await checkRegisteredClients();
        
        // 测试工具调用路由
        await testToolCallRouting();
        
        // 开始状态监控
        testStartTime = Date.now();
        startStatusMonitoring();
        
        console.log(`\n✅ 所有组件已启动，测试将运行 ${TEST_DURATION/1000} 秒...`);
        console.log('💡 观察客户端注册、消息传递和工具调用路由');
        console.log('💡 按 Ctrl+C 可随时停止测试\n');
        
        // 等待测试完成
        await new Promise(resolve => setTimeout(resolve, TEST_DURATION));
        
        console.log('\n⏰ 测试时间到，正在结束...');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        cleanup();
        
        setTimeout(() => {
            console.log('🏁 测试结束');
            process.exit(0);
        }, 5000);
    }
}

// 信号处理
process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号，正在停止测试...');
    cleanup();
    setTimeout(() => process.exit(0), 5000);
});

process.on('SIGTERM', () => {
    console.log('\n⏹️ 收到终止信号，正在停止测试...');
    cleanup();
    setTimeout(() => process.exit(0), 5000);
});

// 启动测试
runTest().catch(console.error);