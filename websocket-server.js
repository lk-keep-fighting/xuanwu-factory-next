const { createServer } = require('http')
const { WebSocketServer } = require('ws')
const { PrismaClient } = require('@prisma/client')
const k8s = require('@kubernetes/client-node')

const port = parseInt(process.env.WS_PORT || '3001', 10)
const prisma = new PrismaClient()

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
  // 解析 URL 获取 serviceId
  // 期望路径: /api/services/:serviceId/terminal
  const urlMatch = request.url?.match(/^\/api\/services\/([^/]+)\/terminal/)
  
  if (!urlMatch) {
    console.log('[WebSocket] Invalid connection path:', request.url)
    ws.close(1008, 'Invalid path')
    return
  }
  
  const serviceId = urlMatch[1]
  handleTerminalConnection(ws, serviceId)
})

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
  console.log(`> WebSocket Terminal Server ready on http://localhost:${port}`)
  console.log(`> Accepting connections at: ws://localhost:${port}/api/services/:id/terminal`)
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
