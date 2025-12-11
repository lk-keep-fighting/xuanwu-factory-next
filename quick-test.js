#!/usr/bin/env node

/**
 * 快速测试调试工具核心功能
 */

async function testAPIs() {
  console.log('🧪 测试核心API功能...\n')
  
  try {
    // 测试Pod列表API
    console.log('📡 测试Pod列表API...')
    const podsResponse = await fetch('http://localhost:3000/api/k8s/pods?namespace=default')
    const podsData = await podsResponse.json()
    
    if (podsData.success && podsData.pods.length > 0) {
      console.log(`✅ 找到 ${podsData.total} 个Pod`)
      console.log(`📋 第一个Pod: ${podsData.pods[0].name} (${podsData.pods[0].status})`)
    } else {
      console.log('⚠️ 没有找到Pod或API返回错误')
    }
    
    // 测试调试会话API
    console.log('\n📡 测试调试会话API...')
    const sessionResponse = await fetch('http://localhost:3000/api/debug/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        podName: 'test-pod',
        namespace: 'default',
        container: 'main'
      })
    })
    const sessionData = await sessionResponse.json()
    
    if (sessionData.success) {
      console.log(`✅ 调试会话创建成功: ${sessionData.sessionId}`)
    } else {
      console.log('⚠️ 调试会话创建失败')
    }
    
    console.log('\n🎉 API测试完成!')
    console.log('\n📋 使用说明:')
    console.log('1. 访问 http://localhost:3000/debug')
    console.log('2. 选择一个Pod开始调试')
    console.log('3. 使用Claude终端、日志查看器等工具')
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

testAPIs()