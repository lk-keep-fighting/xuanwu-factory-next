#!/usr/bin/env node

/**
 * 测试基本的 AI 功能
 */

// 手动设置环境变量
process.env.OLLAMA_BASE_URL = 'http://192.168.44.151:11434'
process.env.OLLAMA_MODEL = 'qwen3-coder:30b'
const { createOpenAI } = require('@ai-sdk/openai')
const { streamText } = require('ai')

async function testBasicAI() {
  console.log('🧪 测试基本 AI 功能...\n')
  
  try {
    // 初始化AI模型
    const aiConfig = {
      provider: process.env.AI_PROVIDER || 'ollama',
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      }
    }

    console.log('AI 配置:', aiConfig)

    if (aiConfig.provider === 'ollama') {
      const ollamaClient = createOpenAI({
        baseURL: `${aiConfig.ollama.baseUrl}/v1`,
        apiKey: 'ollama',
      })
      const aiModel = ollamaClient(aiConfig.ollama.model)
      console.log('✅ AI 模型初始化成功:', aiConfig.ollama.model)

      // 测试基本对话
      console.log('\n📤 发送测试消息...')
      const result = await streamText({
        model: aiModel,
        messages: [
          { role: 'system', content: '你是一个调试助手。请用中文简短回复。' },
          { role: 'user', content: '你好，请帮我查看Pod日志' }
        ],
        temperature: 0.7,
        maxTokens: 200,
      })

      console.log('✅ StreamText 调用成功')

      // 处理流式响应
      let fullResponse = ''
      let partCount = 0
      
      for await (const part of result.fullStream) {
        partCount++
        console.log(`📨 Part ${partCount}: type=${part.type}`)
        
        if (part.type === 'text-delta') {
          fullResponse += part.textDelta
          console.log(`   Text: "${part.textDelta}"`)
        } else {
          console.log(`   Data:`, part)
        }
      }

      console.log(`\n✅ 流处理完成，共 ${partCount} 个部分`)
      console.log(`📄 完整响应 (${fullResponse.length} 字符):`)
      console.log(`"${fullResponse}"`)

      if (fullResponse.length > 0) {
        console.log('\n✅ 基本 AI 功能正常工作')
      } else {
        console.log('\n❌ AI 没有生成响应')
      }

    } else {
      console.log('❌ AI provider 未配置')
    }

  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 运行测试
if (require.main === module) {
  testBasicAI()
}