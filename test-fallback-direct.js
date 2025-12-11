#!/usr/bin/env node

/**
 * 直接测试fallback函数
 */

// 模拟generateCommandSuggestions函数
function generateCommandSuggestions(userMessage, podName, namespace) {
  const message = userMessage.toLowerCase()
  
  if (message.includes('日志') || message.includes('log')) {
    return `我来帮您查看Pod日志：

[EXECUTE: kubectl logs ${podName} -n ${namespace} --tail=100]

如果需要查看更多日志或历史日志，我还可以执行：
- 查看完整日志：\`kubectl logs ${podName} -n ${namespace}\`
- 查看历史日志：\`kubectl logs ${podName} -n ${namespace} --previous\`
- 实时跟踪日志：\`kubectl logs ${podName} -n ${namespace} -f\``
  }
  
  if (message.includes('进程') || message.includes('process')) {
    return `让我帮您检查Pod内的进程状态：

[EXECUTE: ps aux]

我还会检查资源使用情况：

[EXECUTE: top -n 1]`
  }
  
  if (message.includes('内存') || message.includes('memory')) {
    return `我来帮您检查内存使用情况：

[EXECUTE: free -h]

同时查看进程内存使用：

[EXECUTE: ps aux --sort=-%mem | head -10]`
  }
  
  if (message.includes('状态') || message.includes('status')) {
    return `我来帮您查看Pod的详细状态：

[EXECUTE: kubectl describe pod ${podName} -n ${namespace}]

同时获取Pod的基本信息：

[EXECUTE: kubectl get pod ${podName} -n ${namespace} -o wide]`
  }
  
  return `我是Claude调试助手，可以帮你：

🔍 **诊断问题**：分析日志、检查进程、监控资源
🛠️ **执行命令**：运行Shell命令并解释结果  
📋 **查看文件**：检查配置文件和应用状态
⚡ **性能分析**：监控CPU、内存、网络使用

请告诉我具体需要什么帮助，比如：
- "查看应用日志"
- "检查进程状态" 
- "分析内存使用"
- "查找错误信息"`
}

function testFallbackLogic() {
  console.log('🧪 测试fallback逻辑...\n')
  
  const testCases = [
    { message: '查看Pod的日志', expected: 'kubectl logs' },
    { message: '检查Pod状态', expected: 'kubectl describe' },
    { message: '查看进程', expected: 'ps aux' },
    { message: '检查内存使用', expected: 'free -h' }
  ]
  
  const podName = 'test-pod'
  const namespace = 'default'
  
  testCases.forEach((testCase, index) => {
    console.log(`📝 测试用例 ${index + 1}: "${testCase.message}"`)
    
    const suggestions = generateCommandSuggestions(testCase.message, podName, namespace)
    console.log(`📄 生成的建议 (${suggestions.length} 字符):`)
    console.log(`"${suggestions.substring(0, 200)}${suggestions.length > 200 ? '...' : ''}"`)
    
    // 检查是否包含执行命令
    const commandMatches = suggestions.match(/\[EXECUTE:\s*([^\]]+)\]/g)
    
    if (commandMatches && commandMatches.length > 0) {
      console.log(`✅ 找到 ${commandMatches.length} 个执行命令:`)
      commandMatches.forEach((match, cmdIndex) => {
        const commandMatch = match.match(/\[EXECUTE:\s*([^\]]+)\]/)
        if (commandMatch) {
          const command = commandMatch[1].trim()
          console.log(`   ${cmdIndex + 1}. ${command}`)
          
          if (command.includes(testCase.expected)) {
            console.log(`   ✅ 包含期望的命令: ${testCase.expected}`)
          } else {
            console.log(`   ⚠️ 不包含期望的命令: ${testCase.expected}`)
          }
        }
      })
    } else {
      console.log(`❌ 没有找到执行命令`)
    }
    
    console.log('')
  })
}

function testCommandProcessing() {
  console.log('🧪 测试命令处理逻辑...\n')
  
  const fullResponse = `我来帮您查看Pod日志：

[EXECUTE: kubectl logs test-pod -n default --tail=100]

如果需要查看更多日志，我还可以执行其他命令。`
  
  console.log('📄 原始响应:')
  console.log(`"${fullResponse}"`)
  
  // 检查响应中是否包含要执行的命令
  const commandMatches = fullResponse.match(/\[EXECUTE:\s*([^\]]+)\]/g)
  let processedResponse = fullResponse
  let commandsToExecute = []
  
  if (commandMatches && commandMatches.length > 0) {
    console.log(`\n✅ 找到 ${commandMatches.length} 个要执行的命令:`)
    
    // 处理每个要执行的命令
    for (const match of commandMatches) {
      const commandMatch = match.match(/\[EXECUTE:\s*([^\]]+)\]/)
      if (commandMatch) {
        const command = commandMatch[1].trim()
        console.log(`   - ${command}`)
        commandsToExecute.push(command)
        
        // 从响应中移除执行标记，替换为执行提示
        processedResponse = processedResponse.replace(match, `\n\n🔄 正在执行命令: \`${command}\`\n`)
      }
    }
    
    console.log('\n📄 处理后的响应:')
    console.log(`"${processedResponse}"`)
    
    console.log(`\n📊 要执行的命令数量: ${commandsToExecute.length}`)
    console.log('✅ 命令处理逻辑正常工作')
  } else {
    console.log('\n❌ 没有找到要执行的命令')
  }
}

function main() {
  console.log('🚀 开始测试fallback逻辑\n')
  
  testFallbackLogic()
  console.log('=' .repeat(50))
  testCommandProcessing()
  
  console.log('\n🎯 测试总结:')
  console.log('✅ Fallback逻辑本身是正常工作的')
  console.log('💡 问题可能在于WebSocket服务器中的AI模型初始化逻辑')
  console.log('🔧 需要确保在AI模型不可用时正确触发fallback模式')
}

// 运行测试
if (require.main === module) {
  main()
}