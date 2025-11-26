'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './xterm.css'

// 动态导入xterm，禁用SSR
let Terminal: any
let FitAddon: any
let WebLinksAddon: any

if (typeof window !== 'undefined') {
  Terminal = require('xterm').Terminal
  FitAddon = require('xterm-addon-fit').FitAddon
  WebLinksAddon = require('xterm-addon-web-links').WebLinksAddon
}

export default function TerminalPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const serviceId = params.serviceId as string

  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const [isConnected, setIsConnected] = useState(false)
  const [serviceName, setServiceName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [terminalReady, setTerminalReady] = useState(false)

  // 加载服务信息
  useEffect(() => {
    const loadService = async () => {
      try {
        const response = await fetch(`/api/services/${serviceId}`)
        if (response.ok) {
          const service = await response.json()
          setServiceName(service.name || '')
        }
      } catch (error) {
        console.error('Failed to load service:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (typeof window !== 'undefined') {
      loadService()
    }
  }, [serviceId])

  // 确保DOM已挂载
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 初始化终端
  useEffect(() => {
    if (!isMounted || !Terminal || !terminalRef.current || terminalInstanceRef.current) {
      console.log('[Terminal] Skipping init:', { 
        isMounted,
        hasTerminal: !!Terminal,
        hasRef: !!terminalRef.current, 
        hasInstance: !!terminalInstanceRef.current
      })
      return
    }
    
    console.log('[Terminal] Initializing terminal instance')

    // 创建终端实例
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      rows: 30,
      cols: 100
    })

    // 添加插件
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    // 挂载终端
    terminal.open(terminalRef.current)
    fitAddon.fit()

    terminalInstanceRef.current = terminal
    fitAddonRef.current = fitAddon

    // 显示欢迎信息
    terminal.writeln('\x1b[1;36m正在连接到容器...\x1b[0m')
    terminal.writeln('')
    
    // 通知terminal就绪，可以开始WebSocket连接
    setTerminalReady(true)
    console.log('[Terminal] Terminal ready, will start WebSocket connection')

    // 清理函数
    return () => {
      terminal.dispose()
      terminalInstanceRef.current = null
      fitAddonRef.current = null
    }
  }, [isMounted])

  // WebSocket连接
  useEffect(() => {
    if (!terminalReady || !terminalInstanceRef.current || !serviceId || typeof window === 'undefined') {
      console.log('[Terminal] Skipping WebSocket:', { 
        terminalReady,
        hasTerminal: !!terminalInstanceRef.current, 
        hasServiceId: !!serviceId, 
        isClient: typeof window !== 'undefined'
      })
      return
    }

    const terminal = terminalInstanceRef.current
    let isCancelled = false
    
    // 异步获取配置并连接WebSocket
    const connectWebSocket = async () => {
      try {
        // 从服务端获取运行时配置
        const configRes = await fetch('/api/config')
        const config = await configRes.json()
        
        if (isCancelled) return
        
        // WebSocket地址构造规则
        let wsUrl: string
        
        if (config.wsUrl) {
          // 使用K8s环境变量配置的URL
          wsUrl = `${config.wsUrl}/api/services/${serviceId}/terminal`
        } else {
          // 自动构造（本地开发或未配置环境变量）
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const hostname = window.location.hostname
          
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // 本地开发
            wsUrl = `${protocol}//${hostname}:3001/api/services/${serviceId}/terminal`
          } else {
            // 生产环境fallback：域名替换规则
            const wsHostname = hostname.replace(/(-next)(\.|\/|$)/, '$1-ws$2')
            wsUrl = `${protocol}//${wsHostname}/api/services/${serviceId}/terminal`
          }
        }
        
        console.log('[Terminal] Connecting to WebSocket:', wsUrl)

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          if (isCancelled) {
            ws.close()
            return
          }
          setIsConnected(true)
          terminal.writeln('\x1b[1;32m✓ 已连接到容器\x1b[0m')
          terminal.writeln('')
          
          // 监听用户输入
          terminal.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'input', data }))
            }
          })
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            if (message.type === 'output') {
              terminal.write(message.data)
            } else if (message.type === 'error') {
              terminal.writeln(`\r\n\x1b[1;31m错误: ${message.message}\x1b[0m\r\n`)
            }
          } catch (error) {
            // 如果不是JSON，直接显示
            terminal.write(event.data)
          }
        }

        ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          terminal.writeln('\r\n\x1b[1;31m✗ WebSocket连接错误\x1b[0m\r\n')
          setIsConnected(false)
        }

        ws.onclose = () => {
          terminal.writeln('\r\n\x1b[1;33m连接已关闭\x1b[0m\r\n')
          setIsConnected(false)
        }
      } catch (error) {
        console.error('Failed to create WebSocket:', error)
        terminal.writeln('\r\n\x1b[1;31m✗ 无法建立WebSocket连接\x1b[0m\r\n')
      }
    }
    
    connectWebSocket()

    // 清理函数
    return () => {
      isCancelled = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [terminalReady, serviceId])

  // 窗口大小调整
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalInstanceRef.current) {
        try {
          fitAddonRef.current.fit()
          
          // 通知后端终端大小变化
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const dims = fitAddonRef.current.proposeDimensions()
            if (dims) {
              wsRef.current.send(JSON.stringify({
                type: 'resize',
                rows: dims.rows,
                cols: dims.cols
              }))
            }
          }
        } catch (error) {
          console.error('Failed to fit terminal:', error)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 重新连接
  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    window.location.reload()
  }

  return (
    <div className="flex flex-col fixed inset-0 z-50 bg-gray-900">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/projects/${projectId}/services/${serviceId}`)}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">终端:</span>
            <span className="text-sm text-white font-medium">{serviceName || serviceId}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConnected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReconnect}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重新连接
            </Button>
          )}
        </div>
      </div>

      {/* 终端区域 */}
      <div className="flex-1 p-4 overflow-hidden">
        <div
          ref={terminalRef}
          className="h-full w-full rounded-md"
          style={{ minHeight: '400px' }}
        />
      </div>
    </div>
  )
}
