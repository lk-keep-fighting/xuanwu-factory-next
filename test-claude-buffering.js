#!/usr/bin/env node

/**
 * 专门测试 Claude 响应缓冲机制
 */

const WebSocket = require('ws')

async function testClaudeBuffering() {
  console.log('🧪 测试 Claude 响应缓冲机制...\n')
  
  const podName = 'test-pod'
  const namespace = 'default'
  const container = 'main'
  
  const wsUrl = `ws://localhost:3001/api/debug/claude/${podName}?namespace=${namespace}&container=${container}`
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let messageCount = 0
    let claudeMessages = []
    let startTime = null
    
    ws.on('open', () => {
      console.log('✅ WebSocket 连接已建立')
      
      // 等待欢迎消息后发送测试消息
      setTimeout(() => {
        console.log('📤 发送长文本测试消息...')
        startTime = Date.now()
        ws.send(JSON.stringify({
          type: 'claude_request',
          message: '请详细解释一下Kubernetes Pod的生命周期，包括各个阶段的特点、状态转换、以及在每个阶段可能遇到的问题和解决方案。同时请提供一些实用的kubectl命令来监控和调试Pod状态。',
          context: {}
        }))
      }, 1000)
    })
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        messageCount++
        
        const timestamp = Date.now()
        const timeSinceStart = startTime ? timestamp - startTime : 0
        
        console.log(`📨 [${timeSinceStart}ms] 消息 ${messageCount}: ${message.type}`)
        
        if (message.type === 'claude_response') {
          claudeMessages.push({
            content: message.content,
            timestamp: timestamp,
            length: message.content.length
          })
          
          console.log(`💬 Claude 响应 (${message.content.length} 字符):`)
          console.log(`   "${message.content.substring(0, 80)}${message.content.length > 80 ? '...' : ''}"`)
          
          // 分析消息间隔
          if (claudeMessages.length > 1) {
            const prevMsg = claudeMessages[claudeMessages.length - 2]
            const interval = timestamp - prevMsg.timestamp
            console.log(`⏱️  与上条消息间隔: ${interval}ms`)
          }
        } else if (message.type === 'error') {
          console.log('❌ 错误:', message.message)
        }
        
        // 收到足够消息或等待足够时间后关闭连接
        if (messageCount >= 10 || (startTime && timeSinceStart > 8000)) {
          setTimeout(() => ws.close(), 500)
        }
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    })
    
    ws.on('close', () => {
      console.log('\n🔌 连接已关闭')
      console.log(`📊 总共收到 ${messageCount} 条消息`)
      console.log(`📊 其中 Claude 响应消息: ${claudeMessages.length} 条`)
      
      if (claudeMessages.length > 0) {
        console.log('\n📈 Claude 消息分析:')
        claudeMessages.forEach((msg, index) => {
          console.log(`  消息 ${index + 1}: ${msg.length} 字符`)
        })
        
        const totalChars = claudeMessages.reduce((sum, msg) => sum + msg.length, 0)
        console.log(`📊 总字符数: ${totalChars}`)
        console.log(`📊 平均每条消息: ${Math.round(totalChars / claudeMessages.length)} 字符`)
        
        if (claudeMessages.length > 1) {
          console.log('⚠️  响应被分割成多条消息，缓冲机制可能需要调整')
        } else {
          console.log('✅ 响应合并成功，缓冲机制工作正常')
        }
      }
      
      resolve({
        totalMessages: messageCount,
        claudeMessages: claudeMessages.length,
        fragmented: claudeMessages.length > 1
      })
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
    }, 15000)
  })
}

async function main() {
  console.log('🚀 开始测试 Claude 响应缓冲机制\n')
  
  try {
    const result = await testClaudeBuffering()
    
    console.log('\n📋 测试结果总结:')
    console.log(`- 总消息数: ${result.totalMessages}`)
    console.log(`- Claude 响应消息数: ${result.claudeMessages}`)
    console.log(`- 是否存在分片: ${result.fragmented ? '是' : '否'}`)
    
    if (result.fragmented) {
      console.log('\n🔧 建议调整缓冲参数:')
      console.log('- 增加 BUFFER_SIZE (当前 50 字符)')
      console.log('- 增加 BUFFER_TIMEOUT (当前 200ms)')
      console.log('- 或在前端实现更智能的消息合并逻辑')
    } else {
      console.log('\n✅ 缓冲机制工作正常!')
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
if (require.main === module) {
  main()
}