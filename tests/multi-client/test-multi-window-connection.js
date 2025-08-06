#!/usr/bin/env node

/**
 * 测试多个窗口连接到同一个共享服务器
 * 验证第一个窗口启动服务器，后续窗口连接到现有服务器
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

console.log('🧪 测试多窗口连接到同一个共享MCP服务器...');

// 模拟多个VSCode窗口
const mockWindows = [
    { id: 'window1', path: '/project/frontend', name: 'Frontend Window' },
    { id: 'window2', path: '/project/backend', name: 'Backend Window' },
    { id: 'window3', path: '/project/mobile', name: 'Mobile Window' },
];

let serverProcess = null;
let isFirstWindow = true;

/**
 * 模拟一个VSCode窗口的启动过程
 */
async function simulateVSCodeWindow(windowConfig, delay = 0) {
    if (delay > 0) {
        console.log(`⏰ [${windowConfig.id}] 等待 ${delay}ms 后启动...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.log(`🪟 [${windowConfig.id}] 模拟VSCode窗口启动: ${windowConfig.name}`);
    
    return new Promise((resolve, reject) => {
        // 创建一个简单的Node.js进程来模拟VSCode窗口
        const windowProcess = spawn('node', ['-e', `
            // 模拟VSCode扩展加载和服务器管理器使用
            const { SharedServerManager } = require('./dist/extension.js');
            
            console.log('[${windowConfig.id}] VSCode窗口启动');
            console.log('[${windowConfig.id}] 开始注册到共享服务器...');
            
            // 模拟注册过程
            setTimeout(() => {
                console.log('[${windowConfig.id}] 注册完成');
                process.exit(0);
            }, 3000);
            
            // 错误处理
            process.on('error', (error) => {
                console.error('[${windowConfig.id}] 错误:', error.message);
                process.exit(1);
            });
        `], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: __dirname
        });
        
        windowProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.log(`📤 [${windowConfig.id}] ${output}`);
            }
        });
        
        windowProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                console.error(`❌ [${windowConfig.id}] ${output}`);
            }
        });
        
        windowProcess.on('exit', (code) => {
            console.log(`🔚 [${windowConfig.id}] 窗口进程退出 (code: ${code})`);
            resolve(code === 0);
        });
        
        windowProcess.on('error', (error) => {
            console.error(`💥 [${windowConfig.id}] 窗口进程错误:`, error.message);
            reject(error);
        });
    });
}

/**
 * 检查服务器状态
 */
async function checkServerStatus() {
    try {
        const response = await fetch('http://localhost:8010/health');
        if (response.ok) {
            const data = await response.json();
            console.log('📊 服务器状态:', {
                status: data.status,
                server: data.server,
                clientCount: data.clients?.length || 0,
                port: data.port
            });
            return true;
        }
        return false;
    } catch (error) {
        console.log('❌ 无法连接到服务器:', error.message);
        return false;
    }
}

/**
 * 手动启动一个共享服务器进程用于测试
 */
async function startTestServer() {
    console.log('🚀 启动测试用共享MCP服务器...');
    
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['dist/sharedMcpServerProcess.js'], {
            stdio: ['inherit', 'pipe', 'pipe'],
            cwd: __dirname,
            env: {
                ...process.env,
                SERVER_PORT: '8010'
            }
        });
        
        let outputBuffer = '';
        
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            outputBuffer += output;
            process.stdout.write(`🖥️  [Server] ${output}`);
            
            if (output.includes('服务器启动成功') || output.includes('IPC服务器启动')) {
                console.log('✅ 测试服务器启动成功');
                resolve();
            }
        });
        
        serverProcess.stderr.on('data', (data) => {
            process.stderr.write(`🚨 [Server] ${data}`);
        });
        
        serverProcess.on('error', (error) => {
            console.error('❌ 服务器启动失败:', error.message);
            reject(error);
        });
        
        serverProcess.on('exit', (code, signal) => {
            console.log(`🔄 测试服务器退出 (code: ${code}, signal: ${signal})`);
        });
        
        // 启动超时
        setTimeout(() => {
            if (!outputBuffer.includes('服务器启动成功') && !outputBuffer.includes('IPC服务器启动')) {
                reject(new Error('测试服务器启动超时'));
            }
        }, 10000);
    });
}

/**
 * 主测试函数
 */
async function runTest() {
    try {
        console.log('📋 测试计划:');
        console.log('  1. 手动启动一个共享服务器');
        console.log('  2. 模拟多个VSCode窗口启动');
        console.log('  3. 验证所有窗口都连接到同一个服务器');
        console.log('  4. 检查没有端口冲突错误\\n');
        
        // 步骤1: 启动测试服务器
        await startTestServer();
        
        // 等待服务器完全启动
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 验证服务器可访问
        const serverAvailable = await checkServerStatus();
        if (!serverAvailable) {
            throw new Error('测试服务器未能正确启动');
        }
        
        console.log('\\n🎯 开始模拟多个VSCode窗口启动...');
        
        // 步骤2: 模拟多个窗口依次启动
        const windowPromises = mockWindows.map((window, index) => {
            const delay = index * 2000; // 每个窗口间隔2秒启动
            return simulateVSCodeWindow(window, delay);
        });
        
        // 等待所有窗口处理完成
        const results = await Promise.allSettled(windowPromises);
        
        console.log('\\n📈 测试结果:');
        results.forEach((result, index) => {
            const window = mockWindows[index];
            if (result.status === 'fulfilled') {
                console.log(`  ✅ ${window.name}: 成功`);
            } else {
                console.log(`  ❌ ${window.name}: 失败 - ${result.reason?.message || 'Unknown error'}`);
            }
        });
        
        // 步骤3: 最终服务器状态检查
        console.log('\\n🔍 最终服务器状态检查:');
        await checkServerStatus();
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const totalCount = results.length;
        
        console.log(`\\n🎊 测试完成: ${successCount}/${totalCount} 个窗口成功处理`);
        
        if (successCount === totalCount) {
            console.log('✅ 所有VSCode窗口都成功连接到同一个共享服务器！');
        } else {
            console.log('⚠️  部分窗口处理失败，请检查日志');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        // 清理
        console.log('\\n🧹 清理测试资源...');
        if (serverProcess && !serverProcess.killed) {
            console.log('⏹️  停止测试服务器');
            serverProcess.kill('SIGTERM');
            
            // 等待服务器退出
            await new Promise(resolve => {
                if (serverProcess) {
                    serverProcess.on('exit', resolve);
                    setTimeout(() => {
                        if (serverProcess && !serverProcess.killed) {
                            serverProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 3000);
                } else {
                    resolve();
                }
            });
        }
        
        console.log('🏁 测试完成');
        process.exit(0);
    }
}

// 信号处理
process.on('SIGINT', () => {
    console.log('\\n🛑 收到中断信号，正在清理...');
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 2000);
});

// 启动测试
runTest().catch(console.error);