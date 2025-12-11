/**
 * WebSocket Claude Debug Handler
 * 
 * 处理Claude Code调试终端的WebSocket连接
 */

const { spawn } = require('child_process')
// AI Agent Service - 简化版本用于Claude调试
const { openai, createOpenAI } = require('@ai-sdk/openai')
const { streamText } = require('ai')

/**
 * 处理Claude调试WebSocket连接
 */
async function handleClaudeDebugConnection(ws, request, podName, namespace, container) {
  console.log(`[Claude Debug] New connection for pod: ${podName} in namespace: ${namespace}, container: ${container}`)

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
      console.log('[Claude Debug] Using Ollama:', aiConfig.ollama.model)
    } else {
      console.log('[Claude Debug] AI provider not configured, using mock responses')
    }
  } catch (error) {
    console.error('[Claude Debug] Failed to initialize AI model:', error)
    ws.send(JSON.stringify({
      type: 'error',
      message: '无法初始化 Claude AI 模型'
    }))
    return
  }

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'claude_response',
    content: `🤖 Claude Code 调试助手已连接到 Pod: ${podName}\n\n我可以帮你：\n- 执行命令并分析结果\n- 查看和分析日志文件\n- 检查配置文件\n- 诊断性能问题\n- 排查应用错误\n\n请告诉我你需要什么帮助！`
  }))

  // 处理消息
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'claude_request':
          await handleClaudeRequest(ws, message, aiModel, podName, namespace, container)
          break
          
        case 'execute_command':
          await executeCommand(ws, message.command, message.description, podName, namespace, container)
          break
          
        default:
          console.log('[Claude Debug] Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('[Claude Debug] Message handling error:', error)
      ws.send(JSON.stringify({
        type: 'error',
        message: '消息处理失败'
      }))
    }
  })

  ws.on('close', () => {
    console.log(`[Claude Debug] Connection closed for pod: ${podName}`)
  })

  ws.on('error', (error) => {
    console.error('[Claude Debug] WebSocket error:', error)
  })
}

/**
 * 处理Claude请求
 */
async function handleClaudeRequest(ws, message, aiModel, podName, namespace, container) {
  try {
    const userMessage = message.message
    
    // 检查是否强制使用fallback模式（用于测试）
    const forceFallback = process.env.AI_PROVIDER === 'disabled' || !aiModel
    
    if (forceFallback) {
      console.log('[Claude Debug] Using fallback mode (no AI model)')
      // 如果没有AI模型，提供基本的命令建议并自动执行
      const suggestions = generateCommandSuggestions(userMessage, podName, namespace)
      
      // 检查是否有要执行的命令
      const commandMatches = suggestions.match(/\[EXECUTE:\s*([^\]]+)\]/g)
      let processedSuggestions = suggestions
      
      console.log(`[Claude Debug] Fallback suggestions: ${suggestions.substring(0, 100)}...`)
      console.log(`[Claude Debug] Found ${commandMatches ? commandMatches.length : 0} commands to execute`)
      
      if (commandMatches && commandMatches.length > 0) {
        // 处理每个要执行的命令
        for (const match of commandMatches) {
          const commandMatch = match.match(/\[EXECUTE:\s*([^\]]+)\]/)
          if (commandMatch) {
            const command = commandMatch[1].trim()
            
            console.log(`[Claude Debug] Processing fallback command: ${command}`)
            
            // 从响应中移除执行标记，替换为执行提示
            processedSuggestions = processedSuggestions.replace(match, `\n\n🔄 正在执行命令: \`${command}\`\n`)
            
            // 异步执行命令
            setTimeout(async () => {
              console.log(`[Claude Debug] Executing fallback command: ${command}`)
              await executeCommand(ws, command, `自动执行: ${command}`, podName, namespace, container)
            }, 500)
          }
        }
      }
      
      ws.send(JSON.stringify({
        type: 'claude_response',
        content: processedSuggestions
      }))
      return
    }

    // 构建系统提示
    const systemPrompt = `你是一个Kubernetes Pod调试专家，正在帮助用户调试Pod "${podName}"（命名空间: ${namespace}，容器: ${container}）。

你可以使用以下工具来帮助用户：
1. 查看Pod日志
2. 检查Pod状态和详细信息
3. 在Pod内执行Shell命令
4. 查看Pod内的文件

当用户请求时，你应该主动使用相应的工具来获取信息，然后分析结果并提供专业建议。

请用中文回复，保持专业和友好的语调。`

    // 定义可用的工具
    const tools = {
      viewPodLogs: {
        description: '查看Pod的日志',
        parameters: {
          type: 'object',
          properties: {
            tailLines: {
              type: 'number',
              description: '显示最后多少行日志，默认100',
              default: 100
            },
            previous: {
              type: 'boolean',
              description: '是否查看之前容器的日志（如果Pod重启过）',
              default: false
            }
          }
        }
      },
      describePod: {
        description: '获取Pod的详细状态信息',
        parameters: {
          type: 'object',
          properties: {}
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
          required: ['command']
        }
      },
      listFiles: {
        description: '列出Pod内指定目录的文件',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '要列出的目录路径',
              default: '/app'
            }
          }
        }
      }
    }

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

    // 处理流式响应，包括工具调用
    let fullResponse = ''
    let toolCalls = []
    
    for await (const part of result.fullStream) {
      if (ws.readyState !== ws.OPEN) break
      
      if (part.type === 'text-delta') {
        fullResponse += part.textDelta
      } else if (part.type === 'tool-call') {
        console.log(`[Claude Debug] Tool call: ${part.toolName} with args:`, part.args)
        toolCalls.push(part)
        
        // 立即执行工具调用
        try {
          let toolResult = null
          
          switch (part.toolName) {
            case 'viewPodLogs':
              const tailLines = part.args.tailLines || 100
              const previous = part.args.previous || false
              const logCommand = `kubectl logs ${podName} -n ${namespace} --tail=${tailLines}${previous ? ' --previous' : ''}`
              
              // 发送工具调用通知
              ws.send(JSON.stringify({
                type: 'claude_response',
                content: `\n\n🔄 正在查看Pod日志 (最后${tailLines}行)...\n`
              }))
              
              toolResult = await executeCommandSync(logCommand, podName, namespace, container)
              await executeCommand(ws, logCommand, `查看Pod日志`, podName, namespace, container)
              break
              
            case 'describePod':
              const describeCommand = `kubectl describe pod ${podName} -n ${namespace}`
              
              ws.send(JSON.stringify({
                type: 'claude_response',
                content: `\n\n🔄 正在获取Pod详细信息...\n`
              }))
              
              toolResult = await executeCommandSync(describeCommand, podName, namespace, container)
              await executeCommand(ws, describeCommand, `获取Pod详细信息`, podName, namespace, container)
              break
              
            case 'executeCommand':
              const command = part.args.command
              
              ws.send(JSON.stringify({
                type: 'claude_response',
                content: `\n\n🔄 正在执行命令: \`${command}\`\n`
              }))
              
              toolResult = await executeCommandSync(command, podName, namespace, container)
              await executeCommand(ws, command, `执行命令: ${command}`, podName, namespace, container)
              break
              
            case 'listFiles':
              const path = part.args.path || '/app'
              const listCommand = `ls -la "${path}"`
              
              ws.send(JSON.stringify({
                type: 'claude_response',
                content: `\n\n🔄 正在列出目录 ${path} 的文件...\n`
              }))
              
              toolResult = await executeCommandSync(listCommand, podName, namespace, container)
              await executeCommand(ws, listCommand, `列出文件: ${path}`, podName, namespace, container)
              break
          }
        } catch (error) {
          console.error(`[Claude Debug] Tool execution error:`, error)
          ws.send(JSON.stringify({
            type: 'error',
            message: `工具执行失败: ${error.message}`
          }))
        }
      }
    }
    
    // 检查响应中是否包含要执行的命令
    let commandMatches = fullResponse.match(/\[EXECUTE:\s*([^\]]+)\]/g)
    let processedResponse = fullResponse
    
    // 智能自动执行 - 无论AI是否包含执行命令，都检查用户意图并自动执行
    const userMessageLower = userMessage.toLowerCase()
    let autoCommands = []
    
    console.log(`[Claude Debug] Analyzing user request: "${userMessage}"`)
    console.log(`[Claude Debug] AI response contains ${commandMatches ? commandMatches.length : 0} explicit commands`)
    
    // 检查用户请求的意图并自动执行相关命令
    if (userMessageLower.includes('日志') || userMessageLower.includes('log')) {
      const logCommand = `kubectl logs ${podName} -n ${namespace} --tail=100`
      autoCommands.push(logCommand)
      console.log(`[Claude Debug] Auto-detected log request: ${logCommand}`)
    }
    
    if (userMessageLower.includes('状态') || userMessageLower.includes('status') || userMessageLower.includes('describe')) {
      const statusCommand = `kubectl describe pod ${podName} -n ${namespace}`
      autoCommands.push(statusCommand)
      console.log(`[Claude Debug] Auto-detected status request: ${statusCommand}`)
    }
    
    if (userMessageLower.includes('进程') || userMessageLower.includes('process')) {
      autoCommands.push('ps aux')
      console.log(`[Claude Debug] Auto-detected process request: ps aux`)
    }
    
    if (userMessageLower.includes('内存') || userMessageLower.includes('memory')) {
      autoCommands.push('free -h')
      console.log(`[Claude Debug] Auto-detected memory request: free -h`)
    }
    
    // 处理AI响应中的显式命令
    if (commandMatches && commandMatches.length > 0) {
      console.log(`[Claude Debug] Processing ${commandMatches.length} explicit AI commands`)
      // 处理AI响应中的执行命令
      for (const match of commandMatches) {
        const commandMatch = match.match(/\[EXECUTE:\s*([^\]]+)\]/)
        if (commandMatch) {
          const command = commandMatch[1].trim()
          
          // 从响应中移除执行标记，替换为执行提示
          processedResponse = processedResponse.replace(match, `\n\n🔄 正在执行命令: \`${command}\`\n`)
          
          // 异步执行命令
          setTimeout(async () => {
            console.log(`[Claude Debug] Executing AI command: ${command}`)
            await executeCommand(ws, command, `Claude自动执行: ${command}`, podName, namespace, container)
          }, 500)
        }
      }
    }
    
    // 执行自动检测的命令（如果有的话）
    if (autoCommands.length > 0) {
      console.log(`[Claude Debug] Will execute ${autoCommands.length} auto-detected commands`)
      
      // 在响应中添加执行提示
      autoCommands.forEach(command => {
        processedResponse += `\n\n🔄 正在执行命令: \`${command}\`\n`
      })
      
      // 执行命令
      autoCommands.forEach((command, index) => {
        setTimeout(async () => {
          console.log(`[Claude Debug] Executing auto-command: ${command}`)
          await executeCommand(ws, command, `自动执行: ${command}`, podName, namespace, container)
        }, 1000 + (index * 300))
      })
      console.log(`[Claude Debug] No commands to execute for this request`)
    }
    
    // 然后分块发送处理后的响应
    if (processedResponse.length > 0 && ws.readyState === ws.OPEN) {
      const CHUNK_SIZE = 100 // 每块大小
      const CHUNK_DELAY = 50 // 块间延迟(ms)
      
      if (processedResponse.length <= CHUNK_SIZE) {
        // 如果响应较短，直接发送
        ws.send(JSON.stringify({
          type: 'claude_response',
          content: processedResponse
        }))
      } else {
        // 分块发送较长响应
        let sentLength = 0
        const sendNextChunk = () => {
          if (sentLength < processedResponse.length && ws.readyState === ws.OPEN) {
            const chunk = processedResponse.substring(sentLength, sentLength + CHUNK_SIZE)
            ws.send(JSON.stringify({
              type: 'claude_response',
              content: chunk
            }))
            sentLength += chunk.length
            
            if (sentLength < processedResponse.length) {
              setTimeout(sendNextChunk, CHUNK_DELAY)
            }
          }
        }
        
        sendNextChunk()
      }
    }

  } catch (error) {
    console.error('[Claude Debug] Request handling error:', error)
    
    // 提供备用响应
    const fallbackResponse = generateFallbackResponse(message.message, podName)
    ws.send(JSON.stringify({
      type: 'claude_response',
      content: fallbackResponse
    }))
  }
}

/**
 * 生成命令建议（当AI不可用时）
 */
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

/**
 * 生成备用响应（当AI调用失败时）
 */
function generateFallbackResponse(userMessage, podName) {
  return `抱歉，AI服务暂时不可用。但我仍然可以帮你执行命令来调试Pod "${podName}"。

你可以尝试：
1. 使用预设命令按钮快速执行常见操作
2. 直接输入Shell命令，我会帮你执行
3. 查看日志和文件浏览器标签页

请告诉我需要执行什么命令？`
}

/**
 * 同步执行命令并返回结果（用于工具调用）
 */
async function executeCommandSync(command, podName, namespace, container) {
  return new Promise((resolve, reject) => {
    console.log(`[Claude Debug] Executing sync command: ${command}`)
    
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
      output += data.toString()
    })

    kubectl.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    kubectl.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(errorOutput || `Command failed with exit code ${code}`))
      }
    })

    kubectl.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * 在Pod中执行命令
 */
async function executeCommand(ws, command, description, podName, namespace, container) {
  try {
    console.log(`[Claude Debug] Executing command in pod ${podName}: ${command}`)
    
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

      console.log(`[Claude Debug] Command completed with exit code: ${code}, duration: ${duration}ms`)
    })

    kubectl.on('error', (error) => {
      console.error('[Claude Debug] Command execution error:', error)
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `命令执行失败: ${error.message}`
        }))
      }
    })

  } catch (error) {
    console.error('[Claude Debug] Execute command error:', error)
    ws.send(JSON.stringify({
      type: 'error',
      message: `执行命令失败: ${error.message}`
    }))
  }
}

/**
 * 获取Pod文件内容
 */
async function getPodFileContent(podName, namespace, container, filePath) {
  return new Promise((resolve, reject) => {
    const command = `cat "${filePath}"`
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
      output += data.toString()
    })

    kubectl.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    kubectl.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(errorOutput || `Command failed with exit code ${code}`))
      }
    })

    kubectl.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * 列出Pod目录内容
 */
async function listPodDirectory(podName, namespace, container, dirPath) {
  return new Promise((resolve, reject) => {
    const command = `ls -la "${dirPath}"`
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
      output += data.toString()
    })

    kubectl.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    kubectl.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(new Error(errorOutput || `Command failed with exit code ${code}`))
      }
    })

    kubectl.on('error', (error) => {
      reject(error)
    })
  })
}

module.exports = {
  handleClaudeDebugConnection,
  executeCommand,
  getPodFileContent,
  listPodDirectory
}