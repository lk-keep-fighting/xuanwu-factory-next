#!/usr/bin/env node

/**
 * 玄武AI诊断功能测试脚本
 * 测试通过后端API调用玄武AI服务
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api'

async function testBackendAiDiagnostic(serviceId) {
  console.log('🔍 测试后端AI诊断接口...')
  console.log(`🎯 使用服务ID: ${serviceId}`)
  
  const diagnosticData = {
    namespace: 'default',
    pod: 'test-pod',
    callback_url: 'http://api-adapter.xuanwu-factory.dev.aimstek.cn/logic/ai-debug-callback'
  }
  
  try {
    const response = await fetch(`${API_BASE}/services/${serviceId}/ai-diagnostic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(diagnosticData)
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      console.log('✅ AI诊断任务创建成功')
      console.log(`   任务ID: ${data.data.task_id}`)
      console.log(`   状态: ${data.data.status}`)
      console.log(`   创建时间: ${data.data.created_at}`)
      if (data.data.message) {
        console.log(`   消息: ${data.data.message}`)
      }
    } else {
      console.log('❌ AI诊断任务创建失败')
      console.log(`   状态码: ${response.status}`)
      console.log('   响应:', data)
    }
  } catch (error) {
    console.log('❌ 创建AI诊断任务请求失败')
    console.log(`   错误: ${error.message}`)
  }
  
  console.log('')
}

async function testBackendHealthCheck(serviceId) {
  console.log('🔍 测试后端AI服务健康检查...')
  
  try {
    const response = await fetch(`${API_BASE}/services/${serviceId}/ai-diagnostic`, {
      method: 'GET'
    })
    
    const data = await response.json()
    
    if (response.ok && data.success && data.available) {
      console.log('✅ AI服务健康检查通过')
      console.log('   AI服务正常运行')
    } else {
      console.log('❌ AI服务健康检查失败')
      console.log(`   错误: ${data.error || '服务不可用'}`)
    }
  } catch (error) {
    console.log('❌ AI服务健康检查请求失败')
    console.log(`   错误: ${error.message}`)
  }
  
  console.log('')
}

async function testServiceNotFound() {
  console.log('🔍 测试服务不存在场景...')
  
  const fakeServiceId = 'non-existent-service-id'
  
  try {
    const response = await fetch(`${API_BASE}/services/${fakeServiceId}/ai-diagnostic`, {
      method: 'GET'
    })
    
    const data = await response.json()
    
    if (response.status === 404 && data.error === '服务不存在') {
      console.log('✅ 服务不存在测试通过')
      console.log(`   错误信息: ${data.error}`)
    } else {
      console.log('❌ 服务不存在测试未通过')
      console.log(`   状态码: ${response.status}`)
      console.log('   响应:', data)
    }
  } catch (error) {
    console.log('❌ 服务不存在测试请求失败')
    console.log(`   错误: ${error.message}`)
  }
  
  console.log('')
}

async function main() {
  console.log('🚀 开始测试玄武AI诊断后端API')
  console.log(`📍 API基础URL: ${API_BASE}`)
  console.log('')
  
  // 获取服务ID（这里使用一个示例ID，实际使用时需要替换为真实的服务ID）
  const serviceId = process.argv[2] || 'test-service-id'
  
  // 测试服务不存在场景
  await testServiceNotFound()
  
  // 测试健康检查
  await testBackendHealthCheck(serviceId)
  
  // 测试创建AI诊断任务
  await testBackendAiDiagnostic(serviceId)
  
  console.log('🎉 测试完成')
  console.log('')
  console.log('💡 使用说明:')
  console.log('   1. 确保玄武工厂后端服务正在运行')
  console.log('   2. 确保玄武AI服务正在运行并可访问')
  console.log('   3. 在 .env 文件中配置 XUANWU_AI_BASE_URL')
  console.log('   4. 在服务详情页面的诊断tab中点击"玄武AI诊断"按钮')
  console.log('')
  console.log('🔧 环境变量配置:')
  console.log('   XUANWU_AI_BASE_URL="http://ai-debug.xuanwu-factory.dev.aimstek.cn"')
  console.log('')
  console.log('🔗 默认回调地址:')
  console.log('   http://api-adapter.xuanwu-factory.dev.aimstek.cn/logic/ai-debug-callback')
}

// 运行测试
main().catch(console.error)