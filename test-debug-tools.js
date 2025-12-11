#!/usr/bin/env node

/**
 * 测试新的调试工具功能
 */

const WebSocket = require('ws')

async function testClaudeDebugConnection() {
  console.log('🧪 测试 Claude 调试连接...\n')
  
  const podName = 'test-pod'
  const namespace = 'default'
  const container = 'main'
  
  const wsUrl = `ws://localhost:3001/api/debug/claude/${podName}?namespace=${namespace}&container=${container}`
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let messageCount = 0
    
    ws.on('open', () => {
      console.log('✅ WebSocket 连接已建立')
      
      // 发送测试消息
      setTimeout(() => {
        console.log('📤 发送测试消息...')
        ws.send(JSON.stringify({
          type: 'claude_request',
          message: '你好，请帮我查看这个Pod的状态',
          context: {}
        }))
      }, 1000)
    })
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        messageCount++
        
        console.log(`📨 收到消息 ${messageCount}:`, message.type)
        
        if (message.type === 'claude_response') {
          console.log('💬 Claude 响应:', message.content.substring(0, 100) + '...')
        } else if (message.type === 'error') {
          console.log('❌ 错误:', message.message)
        }
        
        // 收到几条消息后关闭连接
        if (messageCount >= 3) {
          ws.close()
        }
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    })
    
    ws.on('close', () => {
      console.log('🔌 连接已关闭')
      console.log(`📊 总共收到 ${messageCount} 条消息\n`)
      resolve(messageCount > 0)
    })
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket 错误:', error.message)
      reject(error)
    })
    
    // 超时保护
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      reject(new Error('连接超时'))
    }, 10000)
  })
}

async function testLogStreamConnection() {
  console.log('🧪 测试日志流连接...\n')
  
  const podName = 'test-pod'
  const namespace = 'default'
  
  const wsUrl = `ws://localhost:3001/api/k8s/logs/stream?namespace=${namespace}&podName=${podName}`
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let messageCount = 0
    
    ws.on('open', () => {
      console.log('✅ 日志流连接已建立')
    })
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        messageCount++
        
        console.log(`📨 收到日志消息 ${messageCount}:`, message.type)
        
        if (message.type === 'log_line') {
          console.log('📋 日志行:', message.line.substring(0, 50) + '...')
        } else if (message.type === 'error') {
          console.log('❌ 错误:', message.message)
        }
        
        // 收到几条消息后关闭连接
        if (messageCount >= 2) {
          ws.close()
        }
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    })
    
    ws.on('close', () => {
      console.log('🔌 日志流连接已关闭')
      console.log(`📊 总共收到 ${messageCount} 条消息\n`)
      resolve(true)
    })
    
    ws.on('error', (error) => {
      console.error('❌ 日志流错误:', error.message)
      // 日志流可能因为Pod不存在而失败，这是正常的
      resolve(false)
    })
    
    // 超时保护
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      resolve(false)
    }, 5000)
  })
}

async function testAPIEndpoints() {
  console.log('🧪 测试 API 端点...\n')
  
  const tests = [
    {
      name: 'Pod 列表 API',
      url: 'http://localhost:3000/api/k8s/pods?namespace=default',
      method: 'GET'
    },
    {
      name: 'Pod 日志 API', 
      url: 'http://localhost:3000/api/k8s/logs?namespace=default&podName=test-pod',
      method: 'GET'
    },
    {
      name: '调试会话 API',
      url: 'http://localhost:3000/api/debug/session',
      method: 'POST',
      body: {
        podName: 'test-pod',
        namespace: 'default',
        container: 'main'
      }
    }
  ]
  
  for (const test of tests) {
    try {
      console.log(`📡 测试 ${test.name}...`)
      
      const options = {
        method: test.method,
        headers: {
          'Content-Type': 'application/json'
        }
      }
      
      if (test.body) {
        options.body = JSON.stringify(test.body)
      }
      
      const response = await fetch(test.url, options)
      const data = await response.json()
      
      if (response.ok) {
        console.log(`✅ ${test.name} 成功`)
        console.log(`📊 响应状态: ${response.status}`)
        console.log(`📄 响应数据:`, Object.keys(data).join(', '))
      } else {
        console.log(`⚠️ ${test.name} 返回错误: ${response.status}`)
        console.log(`📄 错误信息:`, data.error || data.message)
      }
    } catch (error) {
      console.log(`❌ ${test.name} 失败:`, error.message)
    }
    
    console.log('')
  }
}

async function main() {
  console.log('🚀 开始测试新的调试工具功能\n')
  console.log('=' .repeat(50))
  
  try {
    // 测试 API 端点
    await testAPIEndpoints()
    
    console.log('=' .repeat(50))
    
    // 测试 WebSocket 连接
    try {
      await testClaudeDebugConnection()
      console.log('✅ Claude 调试连接测试通过')
    } catch (error) {
      console.log('⚠️ Claude 调试连接测试失败:', error.message)
    }
    
    try {
      await testLogStreamConnection()
      console.log('✅ 日志流连接测试完成')
    } catch (error) {
      console.log('⚠️ 日志流连接测试失败:', error.message)
    }
    
    console.log('\n🎉 调试工具测试完成!')
    console.log('\n📋 使用说明:')
    console.log('1. 访问 http://localhost:3000/debug 使用调试工具')
    console.log('2. 选择要调试的 Pod')
    console.log('3. 启动调试会话')
    console.log('4. 使用 Claude 终端、日志查看器等功能')
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
    process.exit(1)
  }
}

// 运行测试
if (require.main === module) {
  main()
}