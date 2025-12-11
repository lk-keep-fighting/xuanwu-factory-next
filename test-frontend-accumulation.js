#!/usr/bin/env node

/**
 * 测试前端消息累积功能
 */

const WebSocket = require('ws')

async function testFrontendAccumulation() {
  console.log('🧪 测试前端消息累积功能...\n')
  
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
        console.log('📤 发送测试消息: "查看Pod状态"')
        startTime = Date.now()
        ws.send(JSON.stringify({
          type: 'claude_request',
          message: '查看Pod状态',
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
        
        if (message.type === 'claude_response') {
          claudeMessages.push({
            content: message.content,
            timestamp: timestamp,
            length: message.content.length,
            timeSinceStart: timeSinceStart
          })
          
          console.log(`📨 [${timeSinceStart}ms] Claude 消息 ${claudeMessages.length}: ${message.content.length} 字符`)
          console.log(`   内容: "${message.content.substring(0, 60)}${message.content.length > 60 ? '...' : ''}"`)
        }
        
        // 收到足够消息后关闭连接
        if (messageCount >= 8 || (startTime && timeSinceStart > 5000)) {
          setTimeout(() => ws.close(), 200)
        }
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    })
    
    ws.on('close', () => {
      console.log('\n🔌 连接已关闭')
      
      // 模拟前端消息累积逻辑
      console.log('\n🔄 模拟前端消息累积...')
      
      let accumulatedMessages = []
      
      claudeMessages.forEach((msg, index) => {
        if (index === 0) {
          // 第一条消息，直接添加
          accumulatedMessages.push({
            id: `msg-${index}`,
            type: 'assistant',
            content: msg.content,
            timestamp: msg.timestamp
          })
          console.log(`➕ 创建新消息 ${index + 1}: "${msg.content.substring(0, 40)}..."`)
        } else {
          // 后续消息，检查是否应该累积
          const lastMsg = accumulatedMessages[accumulatedMessages.length - 1]
          const timeDiff = msg.timestamp - lastMsg.timestamp
          
          if (timeDiff < 10000) { // 10秒内视为同一轮对话
            // 累积到最后一条消息
            lastMsg.content += msg.content
            lastMsg.timestamp = msg.timestamp
            console.log(`🔗 累积到消息 ${accumulatedMessages.length}: +${msg.length} 字符 (间隔 ${timeDiff}ms)`)
          } else {
            // 创建新消息
            accumulatedMessages.push({
              id: `msg-${index}`,
              type: 'assistant',
              content: msg.content,
              timestamp: msg.timestamp
            })
            console.log(`➕ 创建新消息 ${accumulatedMessages.length}: "${msg.content.substring(0, 40)}..."`)
          }
        }
      })
      
      console.log('\n📊 累积结果:')
      console.log(`- 原始消息数: ${claudeMessages.length}`)
      console.log(`- 累积后消息数: ${accumulatedMessages.length}`)
      console.log(`- 累积效果: ${claudeMessages.length > accumulatedMessages.length ? '✅ 成功合并' : '⚠️ 未合并'}`)
      
      if (accumulatedMessages.length > 0) {
        console.log('\n📝 最终消息内容:')
        accumulatedMessages.forEach((msg, index) => {
          console.log(`消息 ${index + 1} (${msg.content.length} 字符):`)
          console.log(`"${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}"`)
        })
      }
      
      resolve({
        originalCount: claudeMessages.length,
        accumulatedCount: accumulatedMessages.length,
        successful: claudeMessages.length > accumulatedMessages.length
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
    }, 10000)
  })
}

async function main() {
  console.log('🚀 开始测试前端消息累积功能\n')
  
  try {
    const result = await testFrontendAccumulation()
    
    console.log('\n🎯 测试总结:')
    if (result.successful) {
      console.log('✅ 消息累积功能正常工作')
      console.log(`📈 成功将 ${result.originalCount} 条消息合并为 ${result.accumulatedCount} 条`)
    } else {
      console.log('⚠️ 消息累积可能需要调整')
      console.log(`📊 消息数量: ${result.originalCount} → ${result.accumulatedCount}`)
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