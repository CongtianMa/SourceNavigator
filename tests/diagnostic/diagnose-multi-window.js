#!/usr/bin/env node

/**
 * SourceNavigator 多窗口问题诊断工具
 * 帮助定位和解决多窗口连接共享服务器的问题
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('🔍 SourceNavigator 多窗口问题诊断工具');
console.log('=====================================\n');

const lockFilePath = path.join(os.tmpdir(), 'source-navigator-server.lock');
const serverPort = 8010;

/**
 * 检查端口占用情况
 */
async function checkPortUsage() {
    console.log('📍 1. 检查端口 8010 占用情况');
    console.log('----------------------------');
    
    try {
        const result = await new Promise((resolve, reject) => {
            exec(`lsof -i:${serverPort}`, (error, stdout, stderr) => {
                if (error && error.code === 1) {
                    // 没有进程占用端口，这是正常的
                    resolve('');
                } else if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
        
        if (result.trim()) {
            console.log('❌ 发现进程占用端口 8010:');
            console.log(result);
            
            // 解析进程信息
            const lines = result.trim().split('\n');
            if (lines.length > 1) {
                const processLine = lines[1];
                const parts = processLine.split(/\s+/);
                const command = parts[0];
                const pid = parts[1];
                const user = parts[2];
                
                console.log(`📋 进程详情:`);
                console.log(`   命令: ${command}`);
                console.log(`   PID: ${pid}`);
                console.log(`   用户: ${user}`);
                
                if (command === 'node') {
                    console.log('💡 这可能是一个SourceNavigator共享服务器进程');
                    console.log(`💡 如果您确定这是僵尸进程，可以运行: kill -9 ${pid}`);
                } else {
                    console.log('⚠️  这是其他程序占用的端口，需要先停止该程序');
                }
            }
        } else {
            console.log('✅ 端口 8010 当前未被占用');
        }
    } catch (error) {
        console.log(`❌ 检查端口占用失败: ${error.message}`);
    }
    
    console.log('');
}

/**
 * 检查锁文件状态
 */
async function checkLockFile() {
    console.log('📁 2. 检查锁文件状态');
    console.log('------------------');
    
    if (fs.existsSync(lockFilePath)) {
        console.log(`✅ 发现锁文件: ${lockFilePath}`);
        
        try {
            const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
            console.log('📋 锁文件内容:');
            console.log(`   PID: ${lockData.pid}`);
            console.log(`   端口: ${lockData.port}`);
            console.log(`   启动时间: ${new Date(lockData.startTime).toLocaleString()}`);
            console.log(`   服务器类型: ${lockData.serverType || '未指定'}`);
            
            // 检查进程是否还在运行
            try {
                process.kill(lockData.pid, 0);
                console.log(`✅ 锁文件中的进程 ${lockData.pid} 仍在运行`);
            } catch (processError) {
                console.log(`❌ 锁文件中的进程 ${lockData.pid} 已不存在`);
                console.log('💡 建议清理锁文件: rm -f ' + lockFilePath);
            }
            
        } catch (parseError) {
            console.log(`❌ 锁文件格式错误: ${parseError.message}`);
            console.log('💡 建议删除损坏的锁文件: rm -f ' + lockFilePath);
        }
    } else {
        console.log('❌ 未发现锁文件');
        console.log('💡 这表明当前没有共享服务器在运行，或者锁文件丢失');
    }
    
    console.log('');
}

/**
 * 检查服务器可访问性
 */
async function checkServerAccessibility() {
    console.log('🌐 3. 检查服务器 HTTP 可访问性');
    console.log('-----------------------------');
    
    try {
        const response = await fetch(`http://localhost:${serverPort}/health`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 服务器 HTTP 端点可访问');
            console.log('📋 服务器响应:');
            console.log(`   状态: ${data.status}`);
            console.log(`   服务器: ${data.server}`);
            console.log(`   端口: ${data.port}`);
            console.log(`   客户端数: ${data.clients ? data.clients.length : 0}`);
            
            if (data.clients && data.clients.length > 0) {
                console.log('👥 已连接的客户端:');
                data.clients.forEach((client, index) => {
                    console.log(`   ${index + 1}. ${client.workspaceName} (${client.clientId})`);
                });
            }
        } else {
            console.log(`❌ 服务器响应异常: ${response.status}`);
        }
    } catch (error) {
        console.log(`❌ 无法连接到服务器: ${error.message}`);
        console.log('💡 这表明服务器未运行或不可访问');
    }
    
    console.log('');
}

/**
 * 检查编译状态
 */
async function checkCompilationStatus() {
    console.log('🔨 4. 检查编译状态');
    console.log('----------------');
    
    const distPath = path.join(__dirname, 'dist');
    const sharedServerPath = path.join(distPath, 'sharedMcpServerProcess.js');
    const extensionPath = path.join(distPath, 'extension.js');
    
    if (fs.existsSync(distPath)) {
        console.log('✅ dist 目录存在');
        
        if (fs.existsSync(sharedServerPath)) {
            const stats = fs.statSync(sharedServerPath);
            console.log(`✅ 共享服务器脚本存在 (修改时间: ${stats.mtime.toLocaleString()})`);
        } else {
            console.log('❌ 共享服务器脚本不存在');
            console.log('💡 请运行: npm run compile');
        }
        
        if (fs.existsSync(extensionPath)) {
            const stats = fs.statSync(extensionPath);
            console.log(`✅ 扩展脚本存在 (修改时间: ${stats.mtime.toLocaleString()})`);
        } else {
            console.log('❌ 扩展脚本不存在');
            console.log('💡 请运行: npm run compile');
        }
    } else {
        console.log('❌ dist 目录不存在');
        console.log('💡 请运行: npm run compile');
    }
    
    console.log('');
}

/**
 * 提供解决方案建议
 */
function provideSolutions() {
    console.log('💡 5. 常见问题解决方案');
    console.log('----------------------');
    
    console.log('🔧 如果第二个 VSCode 窗口报告端口被占用:');
    console.log('   1. 检查是否有僵尸进程: lsof -i:8010');
    console.log('   2. 清理僵尸进程: kill -9 <PID>');
    console.log('   3. 清理锁文件: rm -f ' + lockFilePath);
    console.log('   4. 重新编译: npm run compile');
    console.log('   5. 重启 VSCode 窗口');
    
    console.log('\\n🔄 如果服务器检测逻辑失效:');
    console.log('   1. 确保编译最新代码: npm run compile');
    console.log('   2. 检查网络连接到 localhost:8010');
    console.log('   3. 查看 VSCode 输出面板的错误信息');
    
    console.log('\\n🧹 完全重置环境:');
    console.log('   1. 关闭所有 VSCode 窗口');
    console.log('   2. kill -9 $(lsof -ti:8010) 2>/dev/null || true');
    console.log('   3. rm -f ' + lockFilePath);
    console.log('   4. npm run compile');
    console.log('   5. 重新打开 VSCode 窗口');
    
    console.log('\\n📞 如果问题仍然存在:');
    console.log('   1. 保存本诊断报告的输出');
    console.log('   2. 查看 VSCode 开发者工具控制台');
    console.log('   3. 检查 VSCode 输出面板 -> SourceNavigator');
    
    console.log('');
}

/**
 * 运行完整诊断
 */
async function runDiagnosis() {
    try {
        const startTime = new Date();
        console.log(`🕐 诊断开始时间: ${startTime.toLocaleString()}\\n`);
        
        await checkPortUsage();
        await checkLockFile();
        await checkServerAccessibility();
        await checkCompilationStatus();
        provideSolutions();
        
        const endTime = new Date();
        console.log(`✅ 诊断完成时间: ${endTime.toLocaleString()}`);
        console.log(`⏱️  诊断耗时: ${endTime - startTime}ms`);
        
    } catch (error) {
        console.error('❌ 诊断过程中发生错误:', error.message);
    }
}

// 运行诊断
runDiagnosis();