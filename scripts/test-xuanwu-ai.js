#!/usr/bin/env node

/**
 * 玄武AI诊断功能测试脚本
 * 用于测试玄武AI诊断服务的连接和功能
 */

const XUANWU_AI_BASE_URL = process.env.XUANWU_AI_BASE_URL || 'http://ai-debug.xuanwu-factory.dev.aimstek.cn'

async function testHealthCheck() {
  console.log('🔍 测试玄武AI服务健康检查...')
  console.log(`📍 服务地址: ${XUANWU_AI_BASE_URL}`)
  
  try {
    const response = await fetch(`${XUANWU_AI_BASE_URL}/health`, {
      method: 'GET',
      timeout: 5000
    })
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      console.log('✅ 玄武AI服务健康检查通过')
      console.log('   响应:', data)
    } else {
      console.log('❌ 玄武AI服务健康检查失败')
      console.log(`   状态码: ${response.status}`)
      console.log(`   状态文本: ${response.statusText}`)
    }
  } catch (error) {
    console.log('❌ 玄武AI服务连接失败')
    console.log(`   错误: ${error.message}`)
  }
  
  console.log('')
}

async function testCreateTask() {
  console.log('🔍 测试创建AI诊断任务...')
  
  const taskData = {
    namespace: 'default',
    pod: 'test-pod',
    repo_url: 'https://github.com/example/repo.git',
    branch: 'main',
    callback_url: 'http://api-adapter.xuanwu-factory.dev.aimstek.cn/logic/ai-debug-callback'
  }
  
  try {
    const response = await fetch(`${XUANWU_AI_BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ AI诊断任务创建成功')
      console.log(`   任务ID: ${data.task_id}`)
      console.log(`   状态: ${data.status}`)
      console.log(`   创建时间: ${data.created_at}`)
      if (data.message) {
        console.log(`   消息: ${data.message}`)
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

async function testServiceAvailability() {
  console.log('🔍 测试服务可用性检查...')
  
  // 模拟前端的服务可用性检查逻辑
  if (!XUANWU_AI_BASE_URL) {
    console.log('❌ 玄武AI服务地址未配置')
    return
  }

  try {
    const response = await fetch(`${XUANWU_AI_BASE_URL}/health`, {
      method: 'GET',
      timeout: 5000
    })

    if (response.ok) {
      console.log('✅ 服务可用性检查通过')
      console.log('   玄武AI服务正常运行')
    } else {
      console.log('❌ 服务可用性检查失败')
      console.log(`   服务不可用 (HTTP ${response.status})`)
    }
  } catch (error) {
    console.log('❌ 服务可用性检查失败')
    console.log(`   连接失败: ${error.message}`)
  }
  
  console.log('')
}

async function main() {
  console.log('🚀 开始测试玄武AI诊断功能')
  console.log('')
  
  // 测试服务可用性
  await testServiceAvailability()
  
  // 测试健康检查
  await testHealthCheck()
  
  // 测试创建任务
  await testCreateTask()
  
  console.log('🎉 测试完成')
  console.log('')
  console.log('💡 使用说明:')
  console.log('   1. 确保玄武AI服务正在运行')
  console.log('   2. 在 .env 文件中配置 XUANWU_AI_BASE_URL')
  console.log('   3. 在服务详情页面的诊断tab中点击"玄武AI诊断"按钮')
  console.log('')
  console.log('🔧 环境变量配置示例:')
  console.log('   XUANWU_AI_BASE_URL="http://ai-debug.xuanwu-factory.dev.aimstek.cn"')
  console.log('   NEXT_PUBLIC_XUANWU_AI_BASE_URL="https://ai.xuanwu-factory.com"')
  console.log('')
  console.log('🔗 默认回调地址:')
  console.log('   http://api-adapter.xuanwu-factory.dev.aimstek.cn/logic/ai-debug-callback')
}

// 运行测试
main().catch(console.error)