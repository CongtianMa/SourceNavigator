const { default: ipc } = require('node-ipc');
const http = require('http');

console.log('🎭 测试多客户端注册到共享MCP服务器...');

let mockClients = [];

/**
 * 简化的模拟客户端类
 */
class SimpleClient {
    constructor(clientId, workspacePath, workspaceName) {
        this.clientId = clientId;
        this.workspacePath = workspacePath;
        this.workspaceName = workspaceName;
        this.isConnected = false;
        this.connectionPromise = null;
    }

    async connect() {
        if (this.isConnected) {
            return;
        }

        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            console.log(`[${this.clientId}] 尝试连接到共享服务器...`);
            
            // 使用全局ipc实例，但设置新的ID
            const originalId = ipc.config.id;
            ipc.config.id = this.clientId;
            ipc.config.retry = 1500;
            ipc.config.silent = true;
            
            ipc.connectTo('sharedMcpServerProcess', () => {
                ipc.of.sharedMcpServerProcess.on('connect', () => {
                    console.log(`[${this.clientId}] ✅ IPC连接成功`);
                    this.isConnected = true;
                    this.setupEventHandlers();
                    resolve();
                });

                ipc.of.sharedMcpServerProcess.on('disconnect', () => {
                    console.log(`[${this.clientId}] ❌ IPC连接断开`);
                    this.isConnected = false;
                });

                ipc.of.sharedMcpServerProcess.on('error', (error) => {
                    console.error(`[${this.clientId}] IPC连接错误:`, error.message);
                    reject(error);
                });
            });

            // 连接超时
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error(`[${this.clientId}] 连接超时`));
                }
            }, 5000);
        });

        return this.connectionPromise;
    }

    setupEventHandlers() {
        // 为每个客户端创建唯一的事件处理器
        this.registerResponseHandler = (data) => {
            console.log(`[${this.clientId}] 收到注册响应:`, data.success ? '✅ 成功' : '❌ 失败');
        };

        this.toolCallHandler = async (data) => {
            console.log(`[${this.clientId}] 收到工具调用: ${data.toolName}`);
            
            const result = {
                clientId: this.clientId,
                workspacePath: this.workspacePath,
                result: `来自 ${this.clientId} 的响应`
            };

            ipc.of.sharedMcpServerProcess.emit('tool-call-response', {
                requestId: data.requestId,
                result
            });
        };

        // 注册事件处理器
        ipc.of.sharedMcpServerProcess.on('register-response', this.registerResponseHandler);
        ipc.of.sharedMcpServerProcess.on('tool-call-request', this.toolCallHandler);
    }

    async register() {
        if (!this.isConnected) {
            await this.connect();
        }

        return new Promise((resolve, reject) => {
            const registration = {
                workspacePath: this.workspacePath,
                workspaceName: this.workspaceName,
                clientId: this.clientId,
                config: {
                    includePatterns: ["**/*"],
                    excludePatterns: ["node_modules/**"],
                    maxFileSize: 1024 * 1024
                },
                pid: process.pid
            };

            console.log(`[${this.clientId}] 发送注册请求...`);
            ipc.of.sharedMcpServerProcess.emit('register', registration);

            const timeout = setTimeout(() => {
                reject(new Error(`[${this.clientId}] 注册超时`));
            }, 3000);

            const onResponse = (data) => {
                clearTimeout(timeout);
                ipc.of.sharedMcpServerProcess.off('register-response', onResponse);
                
                if (data.success) {
                    console.log(`[${this.clientId}] ✅ 注册成功`);
                    resolve(data);
                } else {
                    console.error(`[${this.clientId}] ❌ 注册失败:`, data.error);
                    reject(new Error(data.error));
                }
            };

            ipc.of.sharedMcpServerProcess.on('register-response', onResponse);
        });
    }

    disconnect() {
        if (this.isConnected) {
            console.log(`[${this.clientId}] 断开连接`);
            
            // 清理事件处理器
            if (this.registerResponseHandler) {
                ipc.of.sharedMcpServerProcess.off('register-response', this.registerResponseHandler);
            }
            if (this.toolCallHandler) {
                ipc.of.sharedMcpServerProcess.off('tool-call-request', this.toolCallHandler);
            }
            
            ipc.disconnect('sharedMcpServerProcess');
            this.isConnected = false;
        }
    }
}

/**
 * 检查服务器状态
 */
async function checkServerStatus() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 8010,
            path: '/clients',
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const clientsData = JSON.parse(data);
                    console.log(`📊 当前注册客户端数: ${clientsData.totalClients}`);
                    resolve(clientsData);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(3000, () => {
            req.destroy();
            reject(new Error('检查状态超时'));
        });
        req.end();
    });
}

/**
 * 主测试函数
 */
async function testMultiClients() {
    try {
        console.log('🏁 开始多客户端注册测试');
        
        // 检查初始状态
        console.log('\n📊 检查初始服务器状态...');
        await checkServerStatus();
        
        // 创建模拟客户端
        console.log('\n🎭 创建模拟客户端...');
        const clientConfigs = [
            { id: 'client_frontend', path: '/project/frontend', name: 'Frontend' },
            { id: 'client_backend', path: '/project/backend', name: 'Backend' },
            { id: 'client_mobile', path: '/project/mobile', name: 'Mobile' }
        ];

        for (const config of clientConfigs) {
            const client = new SimpleClient(config.id, config.path, config.name);
            mockClients.push(client);
            console.log(`📱 创建客户端: ${config.id}`);
        }

        // 逐个注册客户端
        console.log('\n🔄 开始注册客户端...');
        for (let i = 0; i < mockClients.length; i++) {
            const client = mockClients[i];
            console.log(`\n📝 注册客户端 ${i + 1}/${mockClients.length}: ${client.clientId}`);
            
            try {
                await client.register();
                await new Promise(resolve => setTimeout(resolve, 1000));
                await checkServerStatus();
            } catch (error) {
                console.error(`❌ 客户端 ${client.clientId} 注册失败:`, error.message);
            }
        }

        console.log('\n✅ 多客户端注册测试完成！');
        
        // 等待一段时间观察
        console.log('\n⏳ 等待 5 秒观察客户端状态...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('\n📊 最终状态检查:');
        await checkServerStatus();

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        // 清理
        console.log('\n🧹 清理客户端连接...');
        for (const client of mockClients) {
            try {
                client.disconnect();
            } catch (error) {
                console.error(`清理客户端 ${client.clientId} 失败:`, error.message);
            }
        }
        console.log('🏁 测试结束');
        process.exit(0);
    }
}

// 启动测试
testMultiClients().catch(console.error);