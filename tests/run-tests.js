#!/usr/bin/env node

/**
 * SourceNavigator 测试运行器
 * 提供便捷的方式运行各种测试
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = {
    'diagnose': {
        script: 'diagnostic/diagnose-multi-window.js',
        description: '🔍 诊断多窗口问题'
    },
    'multi-client': {
        script: 'multi-client/test-shared-multi-clients.js',
        description: '🏢 完整多客户端测试'
    },
    'multi-window': {
        script: 'multi-client/test-simple-multi-window.js',
        description: '🪟 简化多窗口测试'
    },
    'ipc': {
        script: 'simple-ipc/test-simple-ipc.js',
        description: '📡 基础IPC通信测试'
    }
};

function showUsage() {
    console.log('🧪 SourceNavigator 测试运行器');
    console.log('============================\n');
    
    console.log('用法: node run-tests.js <test-name>\n');
    
    console.log('可用测试:');
    for (const [name, info] of Object.entries(tests)) {
        console.log(`  ${name.padEnd(12)} - ${info.description}`);
    }
    
    console.log('\n示例:');
    console.log('  node run-tests.js diagnose     # 运行诊断工具');
    console.log('  node run-tests.js multi-client # 运行完整多客户端测试');
    console.log('  node run-tests.js multi-window # 运行简化多窗口测试');
    console.log('  node run-tests.js ipc          # 运行IPC通信测试');
}

async function runTest(testName) {
    const test = tests[testName];
    if (!test) {
        console.error(`❌ 未知的测试: ${testName}`);
        console.error('可用测试:', Object.keys(tests).join(', '));
        process.exit(1);
    }
    
    console.log(`🚀 启动测试: ${test.description}`);
    console.log(`📄 脚本路径: ${test.script}`);
    console.log('='.repeat(50));
    
    const scriptPath = path.join(__dirname, test.script);
    
    return new Promise((resolve, reject) => {
        const child = spawn('node', [scriptPath], {
            stdio: 'inherit',
            cwd: path.dirname(__dirname) // 回到项目根目录
        });
        
        child.on('exit', (code) => {
            console.log('='.repeat(50));
            if (code === 0) {
                console.log(`✅ 测试完成: ${test.description}`);
                resolve();
            } else {
                console.log(`❌ 测试失败: ${test.description} (退出码: ${code})`);
                reject(new Error(`测试失败，退出码: ${code}`));
            }
        });
        
        child.on('error', (error) => {
            console.error(`💥 启动测试失败: ${error.message}`);
            reject(error);
        });
    });
}

async function main() {
    const testName = process.argv[2];
    
    if (!testName) {
        showUsage();
        process.exit(1);
    }
    
    if (testName === '--help' || testName === '-h') {
        showUsage();
        process.exit(0);
    }
    
    try {
        await runTest(testName);
    } catch (error) {
        console.error('\n💥 测试执行失败:', error.message);
        process.exit(1);
    }
}

main();