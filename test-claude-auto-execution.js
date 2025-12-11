#!/usr/bin/env node

/**
 * 测试 Claude 自动执行命令功能
 */

const WebSocket = require('ws')

async function testClaudeAutoExecution() {
  console.log('🧪 测试 Claude 自动执行命令功能...\n')
  
  const podName = 'test-pod'
  const namespace = 'default'
  const container = 'main'
  
  const wsUrl = `ws://localhost:3001/api/debug/claude/${podName}?namespace=${namespace}&container=${container}`
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let messageCount = 0
    let commandExecutions = []
    let claudeResponses = []
    let startTime = null
    
    ws.on('open', () => {
      console.log('✅ WebSocket 连接已建立')
      
      // 等待欢迎消息后发送测试消息
      setTimeout(() => {
        console.log('📤 发送测试消息: "查看Pod的日志"')
        startTime = Date.now()
        ws.send(JSON.stringify({
          type: 'claude_request',
          message: '查看Pod的日志',
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
        
        switch (message.type) {
          case 'claude_response':
            claudeResponses.push({
              content: message.content,
              timestamp: timestamp,
              length: message.content.length
            })
            console.log(`💬 Claude 响应 (${message.content.length} 字符):`)
            console.log(`   "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`)
            break
            
          case 'command_start':
            console.log(`🔄 开始执行命令: ${message.command}`)
            commandExecutions.push({
              command: message.command,
              description: message.description,
              startTime: timestamp
            })
            break
            
          case 'command_output':
            console.log(`✅ 命令执行完成: ${message.command}`)
            console.log(`📊 退出码: ${message.exitCode}, 耗时: ${message.duration}ms`)
            console.log(`📄 输出长度: ${message.output ? message.output.length : 0} 字符`)
            if (message.output && message.output.length < 200) {
              console.log(`📄 输出内容: "${message.output.substring(0, 100)}..."`)
            }
            
            // 更新命令执行记录
            const lastExecution = commandExecutions[commandExecutions.length - 1]
            if (lastExecution) {
              lastExecution.completed = true
              lastExecution.exitCode = message.exitCode
              lastExecution.duration = message.duration
              lastExecution.outputLength = message.output ? message.output.length : 0
            }
            break
            
          case 'error':
            console.log('❌ 错误:', message.message)
            break
        }
        
        // 收到足够消息后关闭连接
        if (messageCount >= 10 || (startTime && timeSinceStart > 8000)) {
          setTimeout(() => ws.close(), 1000)
        }
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    })
    
    ws.on('close', () => {
      console.log('\n🔌 连接已关闭')
      
      console.log('\n📊 测试结果分析:')
      console.log(`- 总消息数: ${messageCount}`)
      console.log(`- Claude 响应数: ${claudeResponses.length}`)
      console.log(`- 命令执行数: ${commandExecutions.length}`)
      
      if (commandExecutions.length > 0) {
        console.log('\n🔧 执行的命令:')
        commandExecutions.forEach((cmd, index) => {
          console.log(`  ${index + 1}. ${cmd.command}`)
          console.log(`     描述: ${cmd.description}`)
          if (cmd.completed) {
            console.log(`     结果: 退出码 ${cmd.exitCode}, 耗时 ${cmd.duration}ms, 输出 ${cmd.outputLength} 字符`)
          } else {
            console.log(`     状态: 未完成`)
          }
        })
      }
      
      if (claudeResponses.length > 0) {
        console.log('\n💬 Claude 响应内容:')
        const fullResponse = claudeResponses.map(r => r.content).join('')
        console.log(`完整响应 (${fullResponse.length} 字符):`)
        console.log(`"${fullResponse.substring(0, 300)}${fullResponse.length > 300 ? '...' : ''}"`)
        
        // 检查是否包含执行提示
        const hasExecutionHints = fullResponse.includes('正在执行命令') || fullResponse.includes('🔄')
        console.log(`包含执行提示: ${hasExecutionHints ? '✅ 是' : '❌ 否'}`)
      }
      
      resolve({
        totalMessages: messageCount,
        claudeResponses: claudeResponses.length,
        commandExecutions: commandExecutions.length,
        autoExecutionWorking: commandExecutions.length > 0
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
    }, 12000)
  })
}

async function main() {
  console.log('🚀 开始测试 Claude 自动执行命令功能\n')
  
  try {
    const result = await testClaudeAutoExecution()
    
    console.log('\n🎯 测试总结:')
    if (result.autoExecutionWorking) {
      console.log('✅ Claude 自动执行命令功能正常工作')
      console.log(`📈 成功执行了 ${result.commandExecutions} 个命令`)
    } else {
      console.log('⚠️ Claude 自动执行命令功能可能需要调整')
      console.log('💡 可能的原因:')
      console.log('  - AI 模型未正确配置')
      console.log('  - 命令解析逻辑有问题')
      console.log('  - 网络或权限问题')
    }
    
    console.log('\n📋 使用说明:')
    console.log('现在用户只需要说"查看日志"，Claude 就会自动执行相关命令，无需手动确认。')
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
if (require.main === module) {
  main()
}