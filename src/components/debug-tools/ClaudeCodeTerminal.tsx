'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Terminal, Send, Loader2, Bot, User, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'

interface Pod {
  name: string
  namespace: string
  status: string
}

interface DebugSession {
  active: boolean
  podName: string
  container: string
}

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'command' | 'output'
  content: string
  timestamp: Date
  metadata?: {
    command?: string
    exitCode?: number
    duration?: number
  }
}

interface ClaudeCodeTerminalProps {
  pod: Pod
  debugSession: DebugSession | null
}

export function ClaudeCodeTerminal({ pod, debugSession }: ClaudeCodeTerminalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)


  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 建立WebSocket连接
  useEffect(() => {
    if (!debugSession?.active) return

    const wsUrl = `ws://localhost:3001/api/debug/claude/${pod.name}?namespace=${pod.namespace}&container=${debugSession.container}`
    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      setConnected(true)
      setWs(websocket)
      addMessage({
        type: 'system',
        content: `已连接到 ${pod.name} 的玄武AI调试终端`
      })
    }

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    websocket.onclose = () => {
      setConnected(false)
      setWs(null)
      addMessage({
        type: 'system',
        content: '连接已断开'
      })
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      toast.error("连接错误", {
        description: "无法连接到调试终端"
      })
    }

    return () => {
      websocket.close()
    }
  }, [debugSession, pod])

  // 处理WebSocket消息
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'claude_response':
        // 累积玄武AI响应内容，使用更智能的合并策略
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1]
          const now = Date.now()
          
          // 如果最后一条消息是assistant类型，并且是最近的消息，则累积内容
          if (lastMessage && 
              lastMessage.type === 'assistant' && 
              now - lastMessage.timestamp.getTime() < 15000) { // 15秒内的消息视为同一轮对话
            
            return prev.map((msg, index) => 
              index === prev.length - 1 
                ? { 
                    ...msg, 
                    content: msg.content + data.content,
                    timestamp: new Date(), // 更新时间戳
                    metadata: {
                      ...msg.metadata,
                      isComplete: data.isComplete || false
                    }
                  }
                : msg
            )
          } else {
            // 创建新消息
            return [...prev, {
              id: `${now}-${Math.random().toString(36).substring(2, 11)}`,
              type: 'assistant' as const,
              content: data.content,
              timestamp: new Date(),
              metadata: {
                isComplete: data.isComplete || false
              }
            }]
          }
        })
        break
      
      case 'command_output':
        addMessage({
          type: 'output',
          content: data.output,
          metadata: {
            command: data.command,
            exitCode: data.exitCode,
            duration: data.duration
          }
        })
        break
      
      case 'command_start':
        addMessage({
          type: 'command',
          content: data.command
        })
        break
      
      case 'error':
        addMessage({
          type: 'system',
          content: `错误: ${data.message}`
        })
        toast.error("执行错误", {
          description: data.message
        })
        break
    }
  }

  // 添加消息
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  // 发送消息
  const sendMessage = async () => {
    if (!input.trim() || !ws || !connected) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // 添加用户消息
    addMessage({
      type: 'user',
      content: userMessage
    })

    try {
      // 发送到玄武AI调试终端
      ws.send(JSON.stringify({
        type: 'claude_request',
        message: userMessage,
        context: {
          podName: pod.name,
          namespace: pod.namespace,
          container: debugSession?.container
        }
      }))
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error("发送失败", {
        description: "无法发送消息到调试终端"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 执行预设命令
  const executePresetCommand = (command: string, description: string) => {
    if (!ws || !connected) return

    addMessage({
      type: 'user',
      content: description
    })

    ws.send(JSON.stringify({
      type: 'execute_command',
      command,
      description
    }))
  }

  // 复制消息内容
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("已复制", {
      description: "消息内容已复制到剪贴板"
    })
  }

  // 导出聊天记录
  const exportChat = () => {
    const chatLog = messages.map(msg => 
      `[${msg.timestamp.toLocaleTimeString()}] ${msg.type.toUpperCase()}: ${msg.content}`
    ).join('\n')
    
    const blob = new Blob([chatLog], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-session-${pod.name}-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 预设命令
  const presetCommands = [
    {
      command: 'ps aux',
      description: '查看运行中的进程',
      icon: '🔍'
    },
    {
      command: 'df -h',
      description: '查看磁盘使用情况',
      icon: '💾'
    },
    {
      command: 'free -h',
      description: '查看内存使用情况',
      icon: '🧠'
    },
    {
      command: 'netstat -tulpn',
      description: '查看网络连接',
      icon: '🌐'
    },
    {
      command: 'tail -f /var/log/*.log',
      description: '实时查看日志',
      icon: '📋'
    },
    {
      command: 'find /app -name "*.log" -type f',
      description: '查找日志文件',
      icon: '🔎'
    }
  ]

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4" />
      case 'assistant': return <Bot className="h-4 w-4" />
      case 'command': return <Terminal className="h-4 w-4" />
      case 'system': return <Terminal className="h-4 w-4" />
      default: return null
    }
  }

  const getMessageBgColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-50 border-blue-200'
      case 'assistant': return 'bg-green-50 border-green-200'
      case 'command': return 'bg-purple-50 border-purple-200'
      case 'output': return 'bg-gray-50 border-gray-200'
      case 'system': return 'bg-yellow-50 border-yellow-200'
      default: return 'bg-white border-gray-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* 连接状态 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              玄武AI调试终端
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={connected ? "default" : "secondary"}>
                {connected ? "已连接" : "未连接"}
              </Badge>
              <Button
                onClick={exportChat}
                size="sm"
                variant="outline"
                disabled={messages.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* 预设命令 */}
      {connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">快速命令</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {presetCommands.map((cmd, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => executePresetCommand(cmd.command, cmd.description)}
                  className="justify-start text-left h-auto p-2"
                >
                  <span className="mr-2">{cmd.icon}</span>
                  <div>
                    <div className="font-medium text-xs">{cmd.description}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {cmd.command}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 聊天区域 */}
      <Card className="flex-1">
        <CardContent className="p-0">
          <div className="h-96 overflow-y-auto p-4 space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-3 rounded-lg border ${getMessageBgColor(message.type)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    {getMessageIcon(message.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium capitalize">
                          {message.type === 'assistant' ? '玄武AI' : message.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                        {message.metadata?.exitCode !== undefined && (
                          <Badge 
                            variant={message.metadata.exitCode === 0 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            退出码: {message.metadata.exitCode}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap font-mono">
                        {message.content}
                      </div>
                      {message.metadata?.duration && (
                        <div className="text-xs text-muted-foreground mt-1">
                          执行时间: {message.metadata.duration}ms
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyMessage(message.content)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={connected ? "输入命令或问题，玄武AI 会帮你执行和分析..." : "请先启动调试会话"}
                disabled={!connected || isLoading}
                className="flex-1 min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <Button
                onClick={sendMessage}
                disabled={!connected || !input.trim() || isLoading}
                className="self-end"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              按 Enter 发送，Shift+Enter 换行。玄武AI 可以帮你执行命令、分析日志、检查文件等。
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}