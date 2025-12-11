/**
 * WebSocket Claude Debug Handler with AI Tools
 * 
 * 使用 @ai-sdk/openai 的 tools 功能实现智能命令执行
 */

const { spawn } = require('child_process')
const { createOpenAI } = require('@ai-sdk/openai')
const { streamText } = require('ai')

/**
 * 处理Claude调试WebSocket连接
 */
async function handleClaudeDebugConnection(ws, request, podName, namespace, container) {
  console.log(`[Xuanwu AI Debug] New connection for pod: ${podName} in namespace: ${namespace}, container: ${container}`)

  // 初始化AI模型
  let aiModel = null
  try {
    const aiConfig = {
      provider: process.env.AI_PROVIDER || 'ollama',
      ollama: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      }
    }

    if (aiConfig.provider === 'ollama') {
      const ollamaClient = createOpenAI({
        baseURL: `${aiConfig.ollama.baseUrl}/v1`,
        apiKey: 'ollama',
      })
      aiModel = ollamaClient(aiConfig.ollama.model)
      console.log('[Xuanwu AI Debug] Using Ollama:', aiConfig.ollama.model)
    } else {
      console.log('[Xuanwu AI Debug] AI provider not configured, using fallback mode')
    }
  } catch (error) {
    console.error('[Xuanwu AI Debug] Failed to initialize AI model:', error)
    ws.send(JSON.stringify({
      type: 'error',
      message: '无法初始化 Claude AI 模型'
    }))
    return
  }

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'claude_response',
    content: `🤖 玄武AI调试助手已连接到 Pod: ${podName}\n\n我可以帮你：\n- 查看和分析日志\n- 检查Pod状态\n- 执行调试命令\n- 分析性能问题\n\n请告诉我你需要什么帮助！`
  }))

  // 处理消息
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'claude_request':
          await handleClaudeRequestWithTools(ws, message, aiModel, podName, namespace, container)
          break
          
        case 'execute_command':
          await executeCommand(ws, message.command, message.description, podName, namespace, container)
          break
          
        default:
          console.log('[Xuanwu AI Debug] Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('[Xuanwu AI Debug] Message handling error:', error)
      ws.send(JSON.stringify({
        type: 'error',
        message: '消息处理失败'
      }))
    }
  })

  ws.on('close', () => {
    console.log(`[Xuanwu AI Debug] Connection closed for pod: ${podName}`)
  })

  ws.on('error', (error) => {
    console.error('[Xuanwu AI Debug] WebSocket error:', error)
  })
}

/**
 * 使用 AI Tools 处理Claude请求
 */
async function handleClaudeRequestWithTools(ws, message, aiModel, podName, namespace, container) {
  try {
    const userMessage = message.message
    
    if (!aiModel) {
      // Fallback 模式
      await handleFallbackMode(ws, userMessage, podName, namespace, container)
      return
    }

    // 构建系统提示
    const systemPrompt = `你是玄武AI调试助手，一个专业的Kubernetes Pod调试专家，正在帮助用户调试Pod "${podName}"（命名空间: ${namespace}，容器: ${container}）。

你可以使用以下工具来帮助用户：
1. viewPodLogs - 查看Pod日志
2. describePod - 获取Pod详细状态信息  
3. executeCommand - 在Pod内执行Shell命令
4. listFiles - 列出Pod内的文件

当用户请求查看日志、检查状态、执行命令时，你应该主动使用相应的工具来获取信息，然后分析结果并提供专业建议。

请用中文回复，保持专业和友好的语调。`

    // 定义可用的工具 - 使用正确的 AI SDK 格式
    const tools = {
      viewPodLogs: {
        description: '查看Pod的日志',
        parameters: {
          type: 'object',
          properties: {
            tailLines: {
              type: 'number',
              description: '显示最后多少行日志，默认100'
            },
            previous: {
              type: 'boolean',
              description: '是否查看之前容器的日志（如果Pod重启过）'
            }
          },
          additionalProperties: false
        }
      },
      describePod: {
        description: '获取Pod的详细状态信息',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      executeCommand: {
        description: '在Pod内执行Shell命令',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '要执行的Shell命令'
            }
          },
          required: ['command'],
          additionalProperties: false
        }
      },
      listFiles: {
        description: '列出Pod内指定目录的文件',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '要列出的目录路径'
            }
          },
          additionalProperties: false
        }
      }
    }

    console.log(`[Xuanwu AI Debug] Processing request: "${userMessage}"`)

    console.log(`[Xuanwu AI Debug] Available tools:`, Object.keys(tools))
    
    // 调用AI模型
    const result = await streamText({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      tools: tools,
      temperature: 0.7,
      maxTokens: 1000,
    })
    
    console.log(`[Xuanwu AI Debug] StreamText result created`)

    // 处理流式响应，包括工具调用
    let fullResponse = ''
    let toolCalls = []
    
    try {
      for await (const part of result.fullStream) {
        if (ws.readyState !== ws.OPEN) {
          console.log(`[Xuanwu AI Debug] WebSocket closed, stopping stream processing`)
          break
        }
        
        console.log(`[Xuanwu AI Debug] Stream part type: ${part.type}`)
        
        if (part.type === 'text-delta') {
          fullResponse += part.textDelta
          console.log(`[Xuanwu AI Debug] Text delta: "${part.textDelta}"`)
        } else if (part.type === 'tool-call') {
          console.log(`[Xuanwu AI Debug] Tool call: ${part.toolName} with args:`, part.args)
          toolCalls.push(part)
          
          // 立即执行工具调用
          await executeToolCall(ws, part, podName, namespace, container)
        } else {
          console.log(`[Xuanwu AI Debug] Unknown part type: ${part.type}`, part)
        }
      }
    } catch (streamError) {
      console.error(`[Xuanwu AI Debug] Stream processing error:`, streamError)
      // 继续处理，不要中断
    }
    
    console.log(`[Xuanwu AI Debug] Response complete. Tool calls: ${toolCalls.length}, Response length: ${fullResponse.length}`)
    
    // 如果没有工具调用，但有明确的用户请求，使用关键词检测自动执行
    if (toolCalls.length === 0) {
      console.log(`[Xuanwu AI Debug] No tool calls detected, checking for keyword-based auto-execution`)
      await handleKeywordBasedExecution(ws, userMessage, podName, namespace, container)
    }
    
    // 发送AI的文本响应
    if (fullResponse.length > 0 && ws.readyState === ws.OPEN) {
      sendChunkedResponse(ws, fullResponse)
    }

  } catch (error) {
    console.error('[Xuanwu AI Debug] Request handling error:', error)
    
    // 提供备用响应
    ws.send(JSON.stringify({
      type: 'claude_response',
      content: `抱歉，处理请求时出现错误。我仍然可以帮你执行基本的调试命令。请告诉我需要什么帮助？`
    }))
  }
}

/**
 * 执行工具调用
 */
async function executeToolCall(ws, toolCall, podName, namespace, container) {
  try {
    switch (toolCall.toolName) {
      case 'viewPodLogs':
        const tailLines = toolCall.args.tailLines || 100
        const previous = toolCall.args.previous || false
        const logCommand = `kubectl logs ${podName} -n ${namespace} --tail=${tailLines}${previous ? ' --previous' : ''}`
        
        // 发送工具调用通知
        ws.send(JSON.stringify({
          type: 'claude_response',
          content: `\n\n🔄 正在查看Pod日志 (最后${tailLines}行)...\n`
        }))
        
        await executeKubectlCommand(ws, logCommand, `查看Pod日志`)
        break
        
      case 'describePod':
        const describeCommand = `kubectl describe pod ${podName} -n ${namespace}`
        
        ws.send(JSON.stringify({
          type: 'claude_response',
          content: `\n\n🔄 正在获取Pod详细信息...\n`
        }))
        
        await executeKubectlCommand(ws, describeCommand, `获取Pod详细信息`)
        break
        
      case 'executeCommand':
        const command = toolCall.args.command
        
        ws.send(JSON.stringify({
          type: 'claude_response',
          content: `\n\n🔄 正在执行命令: \`${command}\`\n`
        }))
        
        await executeCommand(ws, command, `执行命令: ${command}`, podName, namespace, container)
        break
        
      case 'listFiles':
        const path = toolCall.args.path || '/app'
        const listCommand = `ls -la "${path}"`
        
        ws.send(JSON.stringify({
          type: 'claude_response',
          content: `\n\n🔄 正在列出目录 ${path} 的文件...\n`
        }))
        
        await executeCommand(ws, listCommand, `列出文件: ${path}`, podName, namespace, container)
        break
        
      default:
        console.log(`[Xuanwu AI Debug] Unknown tool: ${toolCall.toolName}`)
    }
  } catch (error) {
    console.error(`[Xuanwu AI Debug] Tool execution error:`, error)
    ws.send(JSON.stringify({
      type: 'error',
      message: `工具执行失败: ${error.message}`
    }))
  }
}

/**
 * 基于关键词的自动执行（当 AI 不支持 tools 时的备选方案）
 */
async function handleKeywordBasedExecution(ws, userMessage, podName, namespace, container) {
  const userMessageLower = userMessage.toLowerCase()
  let commands = []
  let notifications = []
  
  if (userMessageLower.includes('日志') || userMessageLower.includes('log')) {
    const logCommand = `kubectl logs ${podName} -n ${namespace} --tail=100`
    commands.push({ command: logCommand, type: 'kubectl', description: '查看Pod日志' })
    notifications.push('🔄 正在查看Pod日志...')
    console.log(`[Xuanwu AI Debug] Auto-detected log request: ${logCommand}`)
  }
  
  if (userMessageLower.includes('状态') || userMessageLower.includes('status') || userMessageLower.includes('describe')) {
    const statusCommand = `kubectl describe pod ${podName} -n ${namespace}`
    commands.push({ command: statusCommand, type: 'kubectl', description: '获取Pod状态信息' })
    notifications.push('🔄 正在获取Pod状态信息...')
    console.log(`[Xuanwu AI Debug] Auto-detected status request: ${statusCommand}`)
  }
  
  if (userMessageLower.includes('进程') || userMessageLower.includes('process')) {
    commands.push({ command: 'ps aux', type: 'pod', description: '查看进程信息' })
    notifications.push('🔄 正在查看进程信息...')
    console.log(`[Xuanwu AI Debug] Auto-detected process request: ps aux`)
  }
  
  if (userMessageLower.includes('内存') || userMessageLower.includes('memory')) {
    commands.push({ command: 'free -h', type: 'pod', description: '查看内存使用情况' })
    notifications.push('🔄 正在查看内存使用情况...')
    console.log(`[Xuanwu AI Debug] Auto-detected memory request: free -h`)
  }
  
  // 发送执行通知
  if (notifications.length > 0) {
    const notificationText = '\n\n' + notifications.join('\n') + '\n'
    ws.send(JSON.stringify({
      type: 'claude_response',
      content: notificationText
    }))
  }
  
  // 执行命令
  for (let i = 0; i < commands.length; i++) {
    setTimeout(async () => {
      const cmd = commands[i]
      if (cmd.type === 'kubectl') {
        await executeKubectlCommand(ws, cmd.command, cmd.description)
      } else {
        await executeCommand(ws, cmd.command, cmd.description, podName, namespace, container)
      }
    }, 500 + (i * 300))
  }
  
  console.log(`[Xuanwu AI Debug] Keyword-based execution: ${commands.length} commands scheduled`)
}

/**
 * Fallback 模式处理
 */
async function handleFallbackMode(ws, userMessage, podName, namespace, container) {
  console.log('[Xuanwu AI Debug] Using fallback mode')
  
  const userMessageLower = userMessage.toLowerCase()
  let response = '我来帮您处理这个请求。\n\n'
  let commands = []
  
  if (userMessageLower.includes('日志') || userMessageLower.includes('log')) {
    const logCommand = `kubectl logs ${podName} -n ${namespace} --tail=100`
    commands.push({ command: logCommand, type: 'kubectl', description: '查看Pod日志' })
    response += '🔄 正在查看Pod日志...\n'
  }
  
  if (userMessageLower.includes('状态') || userMessageLower.includes('status') || userMessageLower.includes('describe')) {
    const statusCommand = `kubectl describe pod ${podName} -n ${namespace}`
    commands.push({ command: statusCommand, type: 'kubectl', description: '获取Pod状态信息' })
    response += '🔄 正在获取Pod状态信息...\n'
  }
  
  if (userMessageLower.includes('进程') || userMessageLower.includes('process')) {
    commands.push({ command: 'ps aux', type: 'pod', description: '查看进程信息' })
    response += '🔄 正在查看进程信息...\n'
  }
  
  if (userMessageLower.includes('内存') || userMessageLower.includes('memory')) {
    commands.push({ command: 'free -h', type: 'pod', description: '查看内存使用情况' })
    response += '🔄 正在查看内存使用情况...\n'
  }
  
  // 发送响应
  ws.send(JSON.stringify({
    type: 'claude_response',
    content: response
  }))
  
  // 执行命令
  for (let i = 0; i < commands.length; i++) {
    setTimeout(async () => {
      const cmd = commands[i]
      if (cmd.type === 'kubectl') {
        await executeKubectlCommand(ws, cmd.command, cmd.description)
      } else {
        await executeCommand(ws, cmd.command, cmd.description, podName, namespace, container)
      }
    }, 500 + (i * 300))
  }
}

/**
 * 分块发送响应
 */
function sendChunkedResponse(ws, response) {
  if (response.length <= 100) {
    // 短响应直接发送
    ws.send(JSON.stringify({
      type: 'claude_response',
      content: response
    }))
  } else {
    // 长响应分块发送
    const CHUNK_SIZE = 100
    const CHUNK_DELAY = 50
    
    let sentLength = 0
    const sendNextChunk = () => {
      if (sentLength < response.length && ws.readyState === ws.OPEN) {
        const chunk = response.substring(sentLength, sentLength + CHUNK_SIZE)
        ws.send(JSON.stringify({
          type: 'claude_response',
          content: chunk
        }))
        sentLength += chunk.length
        
        if (sentLength < response.length) {
          setTimeout(sendNextChunk, CHUNK_DELAY)
        }
      }
    }
    
    sendNextChunk()
  }
}

/**
 * 在宿主机上执行 kubectl 命令
 */
async function executeKubectlCommand(ws, command, description) {
  try {
    console.log(`[Xuanwu AI Debug] Executing kubectl command: ${command}`)
    
    // 发送命令开始通知
    ws.send(JSON.stringify({
      type: 'command_start',
      command: command,
      description: description
    }))

    const startTime = Date.now()

    // 直接执行 kubectl 命令
    const kubectl = spawn('kubectl', command.replace('kubectl ', '').split(' '))
    let output = ''
    let errorOutput = ''

    kubectl.stdout.on('data', (data) => {
      const chunk = data.toString()
      output += chunk
      
      // 实时发送输出（可选）
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'command_output_chunk',
          chunk: chunk
        }))
      }
    })

    kubectl.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    kubectl.on('close', (code) => {
      const duration = Date.now() - startTime
      
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'command_output',
          command: command,
          output: output || errorOutput,
          exitCode: code,
          duration: duration,
          success: code === 0
        }))
      }

      console.log(`[Xuanwu AI Debug] Kubectl command completed with exit code: ${code}, duration: ${duration}ms`)
    })

    kubectl.on('error', (error) => {
      console.error('[Xuanwu AI Debug] Kubectl command execution error:', error)
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `kubectl命令执行失败: ${error.message}`
        }))
      }
    })

  } catch (error) {
    console.error('[Xuanwu AI Debug] Execute kubectl command error:', error)
    ws.send(JSON.stringify({
      type: 'error',
      message: `执行kubectl命令失败: ${error.message}`
    }))
  }
}

/**
 * 在Pod中执行命令
 */
async function executeCommand(ws, command, description, podName, namespace, container) {
  try {
    console.log(`[Xuanwu AI Debug] Executing command in pod ${podName}: ${command}`)
    
    // 发送命令开始通知
    ws.send(JSON.stringify({
      type: 'command_start',
      command: command,
      description: description
    }))

    const startTime = Date.now()

    // 使用kubectl exec执行命令
    const kubectlArgs = [
      'exec',
      '-n', namespace,
      podName,
      '-c', container,
      '--',
      'sh', '-c', command
    ]

    const kubectl = spawn('kubectl', kubectlArgs)
    let output = ''
    let errorOutput = ''

    kubectl.stdout.on('data', (data) => {
      const chunk = data.toString()
      output += chunk
      
      // 实时发送输出（可选）
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'command_output_chunk',
          chunk: chunk
        }))
      }
    })

    kubectl.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    kubectl.on('close', (code) => {
      const duration = Date.now() - startTime
      
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'command_output',
          command: command,
          output: output || errorOutput,
          exitCode: code,
          duration: duration,
          success: code === 0
        }))
      }

      console.log(`[Xuanwu AI Debug] Command completed with exit code: ${code}, duration: ${duration}ms`)
    })

    kubectl.on('error', (error) => {
      console.error('[Xuanwu AI Debug] Command execution error:', error)
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `命令执行失败: ${error.message}`
        }))
      }
    })

  } catch (error) {
    console.error('[Xuanwu AI Debug] Execute command error:', error)
    ws.send(JSON.stringify({
      type: 'error',
      message: `执行命令失败: ${error.message}`
    }))
  }
}

module.exports = {
  handleClaudeDebugConnection,
  executeCommand
}