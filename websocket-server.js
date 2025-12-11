// 手动设置环境变量（如果没有 dotenv）
if (!process.env.OLLAMA_BASE_URL) {
  process.env.OLLAMA_BASE_URL = 'http://192.168.44.151:11434'
  process.env.OLLAMA_MODEL = 'qwen3-coder:30b'
  process.env.AI_PROVIDER = 'ollama'
}

const { createServer } = require('http')
const { WebSocketServer } = require('ws')
const { PrismaClient } = require('@prisma/client')
const k8s = require('@kubernetes/client-node')
const { handleClaudeDebugConnection } = require('./websocket-claude-debug-tools')

const port = parseInt(process.env.WS_PORT || '3001', 10)
const prisma = new PrismaClient()

// 连接管理 (简化版，主要用于终端连接)
const connections = new Map()

console.log('[WebSocket] Initializing debug tools server...')

// 初始化 Kubernetes 客户端
function initK8sClient() {
  const kc = new k8s.KubeConfig()
  
  try {
    // 尝试从环境变量加载
    const kubeconfigData = process.env.KUBECONFIG_DATA
    if (kubeconfigData) {
      kc.loadFromString(kubeconfigData)
      console.log('[K8s] Loaded kubeconfig from KUBECONFIG_DATA')
      return kc
    }

    // 尝试从默认位置加载
    kc.loadFromDefault()
    console.log('[K8s] Loaded kubeconfig from default location')
    return kc
  } catch (error) {
    console.error('[K8s] Failed to load kubeconfig:', error.message)
    return null
  }
}

const kc = initK8sClient()

// 创建HTTP服务器（仅用于WebSocket升级）
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('WebSocket Terminal Server\n')
})

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server })

console.log('[WebSocket] Server starting...')

wss.on('connection', (ws, request) => {
  // 解析 URL 获取路径和 serviceId
  const url = request.url || ''
  
  // 终端连接: /api/services/:serviceId/terminal
  const terminalMatch = url.match(/^\/api\/services\/([^/]+)\/terminal/)
  if (terminalMatch) {
    const serviceId = terminalMatch[1]
    handleTerminalConnection(ws, serviceId)
    return
  }
  
  // 保留原有诊断连接以兼容旧功能 (已废弃，建议使用新的调试工具)
  const diagnosticMatch = url.match(/^\/api\/services\/([^/]+)\/diagnostic/)
  if (diagnosticMatch) {
    console.log('[WebSocket] Legacy diagnostic connection detected, closing...')
    ws.close(1000, 'Legacy endpoint deprecated, use /debug instead')
    return
  }
  
  // Claude 调试连接: /api/debug/claude/:podName?namespace=:namespace&container=:container
  const claudeMatch = url.match(/^\/api\/debug\/claude\/([^/?]+)/)
  if (claudeMatch) {
    const podName = claudeMatch[1]
    const urlParams = new URLSearchParams(url.split('?')[1] || '')
    const namespace = urlParams.get('namespace') || 'default'
    const container = urlParams.get('container') || 'main'
    
    handleClaudeDebugConnection(ws, null, podName, namespace, container)
    return
  }
  
  // 日志流连接: /api/k8s/logs/stream?namespace=:namespace&podName=:podName&container=:container
  const logStreamMatch = url.match(/^\/api\/k8s\/logs\/stream/)
  if (logStreamMatch) {
    const urlParams = new URLSearchParams(url.split('?')[1] || '')
    const namespace = urlParams.get('namespace') || 'default'
    const podName = urlParams.get('podName')
    const container = urlParams.get('container')
    
    if (!podName) {
      console.log('[WebSocket] Missing pod name in log stream connection')
      ws.close(1008, 'Pod name required')
      return
    }
    
    handleLogStreamConnection(ws, podName, namespace, container)
    return
  }
  
  // 无效路径
  console.log('[WebSocket] Invalid connection path:', url)
  ws.close(1008, 'Invalid path')
})

// 旧的诊断连接处理已移除，请使用新的调试工具



// 处理终端 WebSocket 连接
async function handleTerminalConnection(ws, serviceId) {
  console.log(`[Terminal] New connection for service: ${serviceId}`)

  let exec = null
  let interval = null

  try {
    // 获取服务信息
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        name: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      ws.send(JSON.stringify({ type: 'error', message: '服务不存在' }))
      ws.close()
      return
    }

    console.log('[Terminal] Service data:', { 
      name: service.name, 
      projectIdentifier: service.project?.identifier 
    })

    const namespace = service.project?.identifier?.trim() || 'default'
    const serviceName = service.name?.trim()
    
    console.log('[Terminal] Resolved namespace:', namespace, 'serviceName:', serviceName)

    if (!namespace || namespace === '') {
      ws.send(JSON.stringify({ type: 'error', message: '项目标识符为空，无法确定namespace' }))
      ws.close()
      return
    }

    if (!serviceName) {
      ws.send(JSON.stringify({ type: 'error', message: '服务名称缺失' }))
      ws.close()
      return
    }

    if (!kc) {
      ws.send(JSON.stringify({ type: 'error', message: 'Kubernetes 配置未加载' }))
      ws.close()
      return
    }

    // 获取 Pod
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
    console.log('[Terminal] Calling listNamespacedPod with namespace:', namespace)
    
    const pods = await k8sApi.listNamespacedPod({
      namespace: namespace,
      labelSelector: `app=${serviceName}`
    })
    
    console.log('[Terminal] Pods response:', pods)

    if (!pods.items || pods.items.length === 0) {
      ws.send(JSON.stringify({ type: 'error', message: '未找到运行的 Pod' }))
      ws.close()
      return
    }

    const pod = pods.items[0]
    const podName = pod.metadata?.name
    const containerName = pod.spec?.containers?.[0]?.name

    if (!podName || !containerName) {
      ws.send(JSON.stringify({ type: 'error', message: 'Pod 信息不完整' }))
      ws.close()
      return
    }

    console.log(`[Terminal] Connecting to pod: ${podName}, container: ${containerName}`)

    // 创建 exec 连接
    const execInstance = new k8s.Exec(kc)
    
    // 使用交互式 shell
    const command = ['/bin/sh']
    
    // 创建流
    const { Writable, Readable } = require('stream')
    
    // stdout流 - 从容器输出到WebSocket
    const stdout = new Writable({
      write(chunk, encoding, callback) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: chunk.toString() }))
        }
        callback()
      }
    })
    
    // stderr流 - 从容器错误输出到WebSocket
    const stderr = new Writable({
      write(chunk, encoding, callback) {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'output', data: chunk.toString() }))
        }
        callback()
      }
    })
    
    // stdin流 - 从WebSocket输入到容器
    const stdin = new Readable({
      read() {}
    })
    
    exec = await execInstance.exec(
      namespace,
      podName,
      containerName,
      command,
      stdout,
      stderr,
      stdin,
      true, // tty
      (status) => {
        console.log(`[Terminal] Exec exited with status:`, status)
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'output', 
            data: '\r\n\x1b[1;33m会话已结束\x1b[0m\r\n' 
          }))
          ws.close()
        }
      }
    )

    // 监听 WebSocket 消息
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString())
        
        if (msg.type === 'input' && stdin) {
          stdin.push(msg.data)
        } else if (msg.type === 'resize') {
          // Kubernetes exec API 不支持动态调整终端大小
          // 这里只是记录，实际调整需要重新建立连接
          console.log(`[Terminal] Resize request: ${msg.cols}x${msg.rows}`)
        }
      } catch (error) {
        console.error('[Terminal] Error processing message:', error)
      }
    })

    // 心跳保持连接
    interval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping()
      }
    }, 30000)

  } catch (error) {
    console.error('[Terminal] Connection error:', error)
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `连接失败: ${error.message}` 
      }))
      ws.close()
    }
  }

  // 清理
  ws.on('close', () => {
    console.log(`[Terminal] Connection closed for service: ${serviceId}`)
    if (interval) {
      clearInterval(interval)
    }
  })

  ws.on('error', (error) => {
    console.error('[Terminal] WebSocket error:', error)
    if (interval) {
      clearInterval(interval)
    }
  })
}

server.listen(port, () => {
  console.log(`> WebSocket Server ready on http://localhost:${port}`)
  console.log(`> Terminal connections: ws://localhost:${port}/api/services/:id/terminal`)
  console.log(`> Diagnostic connections: ws://localhost:${port}/api/services/:id/diagnostic`)
})

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing WebSocket server')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing WebSocket server')
  await prisma.$disconnect()
  process.exit(0)
})

// 处理Claude调试连接 - 使用导入的函数
// handleClaudeDebugConnection 已从 websocket-claude-debug.js 导入

// 处理日志流连接
function handleLogStreamConnection(ws, podName, namespace, container) {
  console.log(`[Log Stream] Starting log stream for pod: ${podName} in namespace: ${namespace}`)
  
  const { spawn } = require('child_process')
  
  // 使用kubectl logs -f 来流式获取日志
  const kubectlArgs = [
    'logs',
    '-f',
    '-n', namespace,
    podName
  ]
  
  if (container) {
    kubectlArgs.push('-c', container)
  }
  
  const kubectl = spawn('kubectl', kubectlArgs)
  
  kubectl.stdout.on('data', (data) => {
    const line = data.toString()
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'log_line',
        line: line.trim(),
        timestamp: new Date().toISOString()
      }))
    }
  })
  
  kubectl.stderr.on('data', (data) => {
    console.error('[Log Stream] kubectl stderr:', data.toString())
  })
  
  kubectl.on('close', (code) => {
    console.log(`[Log Stream] kubectl process closed with code: ${code}`)
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'stream_ended',
        code: code
      }))
    }
  })
  
  kubectl.on('error', (error) => {
    console.error('[Log Stream] kubectl error:', error)
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }))
    }
  })
  
  // 清理资源
  ws.on('close', () => {
    console.log(`[Log Stream] WebSocket closed, killing kubectl process`)
    kubectl.kill()
  })
  
  ws.on('error', (error) => {
    console.error('[Log Stream] WebSocket error:', error)
    kubectl.kill()
  })
}