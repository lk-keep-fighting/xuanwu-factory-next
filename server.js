const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')
const { PrismaClient } = require('@prisma/client')
const k8s = require('@kubernetes/client-node')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

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

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ noServer: true })

  // 处理 WebSocket 升级
  // 注意：开发模式下只处理终端连接，其他让Next.js处理
  server.on('upgrade', (request, socket, head) => {
    const parsedUrl = parse(request.url, true)
    const pathname = parsedUrl.pathname

    // 仅处理终端 WebSocket 路径 /api/services/:id/terminal
    const terminalMatch = pathname?.match(/^\/api\/services\/([^/]+)\/terminal$/)
    
    if (terminalMatch) {
      console.log(`[WebSocket] Handling terminal connection for service: ${terminalMatch[1]}`)
      wss.handleUpgrade(request, socket, head, (ws) => {
        handleTerminalConnection(ws, terminalMatch[1])
      })
      return
    }
    
    // HMR和其他Next.js WebSocket：直接销毁socket
    // Next.js会自己处理，但由于我们已经拦截了upgrade事件，需要手动销毁
    if (dev && pathname?.startsWith('/_next/')) {
      // 开发模式下的HMR连接，不处理，静默失败
      // 这是一个已知问题：自定义服务器会干扰HMR
      console.log(`[WebSocket] Skipping HMR WebSocket: ${pathname}`)
      socket.destroy()
    } else {
      console.log(`[WebSocket] Unknown WebSocket path, destroying: ${pathname}`)
      socket.destroy()
    }
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

      const namespace = service.project?.identifier?.trim() || 'default'
      const serviceName = service.name?.trim()

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
      const pods = await k8sApi.listNamespacedPod({
        namespace,
        labelSelector: `app=${serviceName}`
      })

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
      
      let terminalRows = 30
      let terminalCols = 100

      exec = await execInstance.exec(
        namespace,
        podName,
        containerName,
        command,
        process.stdout, // stdout
        process.stderr, // stderr
        process.stdin,  // stdin
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

      // 重定向输出到 WebSocket
      if (exec.stdout) {
        exec.stdout.on('data', (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString() }))
          }
        })
      }

      if (exec.stderr) {
        exec.stderr.on('data', (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString() }))
          }
        })
      }

      // 监听 WebSocket 消息
      ws.on('message', (message) => {
        try {
          const msg = JSON.parse(message.toString())
          
          if (msg.type === 'input' && exec.stdin) {
            exec.stdin.write(msg.data)
          } else if (msg.type === 'resize') {
            terminalRows = msg.rows || terminalRows
            terminalCols = msg.cols || terminalCols
            // Kubernetes exec API 不支持动态调整终端大小
            // 这里只是记录，实际调整需要重新建立连接
            console.log(`[Terminal] Resize request: ${terminalCols}x${terminalRows}`)
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
      if (exec && exec.stdin) {
        exec.stdin.end()
      }
    })

    ws.on('error', (error) => {
      console.error('[Terminal] WebSocket error:', error)
      if (interval) {
        clearInterval(interval)
      }
    })
  }

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket server ready for terminal connections`)
  })
})

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server')
  await prisma.$disconnect()
  process.exit(0)
})
