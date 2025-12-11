'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Folder, 
  File, 
  FolderOpen, 
  Download, 
  Upload, 
  Edit, 
  Save, 
  X,
  Search,
  RefreshCw,
  Terminal
} from 'lucide-react'
import { toast } from 'sonner'

interface Pod {
  name: string
  namespace: string
}

interface DebugSession {
  active: boolean
  podName: string
  container: string
}

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  permissions?: string
}

interface PodFileExplorerProps {
  pod: Pod
  debugSession: DebugSession | null
}

export function PodFileExplorer({ pod, debugSession }: PodFileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pathHistory, setPathHistory] = useState<string[]>(['/'])


  // 获取目录内容
  const fetchDirectoryContent = async (path: string) => {
    if (!debugSession?.active) return

    setLoading(true)
    try {
      const response = await fetch('/api/debug/files/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: pod.namespace,
          container: debugSession.container,
          path
        })
      })

      if (!response.ok) throw new Error('Failed to fetch directory content')

      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Failed to fetch directory:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      toast.error("获取Pod目录失败", {
        description: `无法读取 ${pod.name} 的目录内容: ${errorMessage}`
      })
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  // 读取文件内容
  const readFile = async (file: FileItem) => {
    if (!debugSession?.active || file.type !== 'file') return

    try {
      const response = await fetch('/api/debug/files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: pod.namespace,
          container: debugSession.container,
          path: file.path
        })
      })

      if (!response.ok) throw new Error('Failed to read file')

      const data = await response.json()
      setFileContent(data.content || '')
      setSelectedFile(file)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to read file:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      toast.error("读取Pod文件失败", {
        description: `无法读取 ${file.name}: ${errorMessage}`
      })
    }
  }

  // 保存文件
  const saveFile = async () => {
    if (!selectedFile || !debugSession?.active) return

    try {
      const response = await fetch('/api/debug/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: pod.namespace,
          container: debugSession.container,
          path: selectedFile.path,
          content: fileContent
        })
      })

      if (!response.ok) throw new Error('Failed to save file')

      setIsEditing(false)
      toast.success("保存成功", {
        description: "文件已保存"
      })
    } catch (error) {
      console.error('Failed to save file:', error)
      toast.error("保存失败", {
        description: "无法保存文件"
      })
    }
  }

  // 下载文件
  const downloadFile = async (file: FileItem) => {
    if (!debugSession?.active || file.type !== 'file') return

    try {
      const response = await fetch('/api/debug/files/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: pod.namespace,
          container: debugSession.container,
          path: file.path
        })
      })

      if (!response.ok) throw new Error('Failed to download file')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download file:', error)
      toast.error("下载失败", {
        description: "无法下载文件"
      })
    }
  }

  // 导航到目录
  const navigateToPath = (path: string) => {
    setCurrentPath(path)
    setPathHistory(prev => [...prev, path])
    fetchDirectoryContent(path)
    setSelectedFile(null)
    setFileContent('')
  }

  // 返回上级目录
  const goBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1)
      const previousPath = newHistory[newHistory.length - 1]
      setPathHistory(newHistory)
      setCurrentPath(previousPath)
      fetchDirectoryContent(previousPath)
      setSelectedFile(null)
      setFileContent('')
    }
  }

  // 搜索文件
  const searchFiles = async () => {
    if (!searchTerm.trim() || !debugSession?.active) return

    setLoading(true)
    try {
      const response = await fetch('/api/debug/files/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          podName: pod.name,
          namespace: pod.namespace,
          container: debugSession.container,
          path: currentPath,
          pattern: searchTerm
        })
      })

      if (!response.ok) throw new Error('Failed to search files')

      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Failed to search files:', error)
      toast.error("搜索失败", {
        description: "无法搜索文件"
      })
    } finally {
      setLoading(false)
    }
  }

  // 在终端中打开
  const openInTerminal = (path: string) => {
    // 这里可以集成到Claude终端
    toast.info("终端命令", {
      description: `cd ${path}`
    })
  }

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // 获取文件图标
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <Folder className="h-4 w-4 text-blue-500" />
    }
    return <File className="h-4 w-4 text-gray-500" />
  }

  useEffect(() => {
    if (debugSession?.active) {
      fetchDirectoryContent(currentPath)
    }
  }, [debugSession])

  if (!debugSession?.active) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>请先启动调试会话以浏览Pod文件系统</p>
            <p className="text-sm mt-2">选择Pod后启动调试会话即可访问容器内的文件</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 文件浏览器 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Pod 文件系统
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={goBack}
                size="sm"
                variant="outline"
                disabled={pathHistory.length <= 1}
              >
                返回
              </Button>
              <Button
                onClick={() => fetchDirectoryContent(currentPath)}
                size="sm"
                variant="outline"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 路径导航 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Pod路径:</span>
            <code className="flex-1 text-sm bg-muted px-2 py-1 rounded">
              {pod.name}:{currentPath}
            </code>
            <Button
              onClick={() => openInTerminal(currentPath)}
              size="sm"
              variant="outline"
              title="在终端中打开此路径"
            >
              <Terminal className="h-4 w-4" />
            </Button>
          </div>

          {/* 搜索 */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索文件..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchFiles()}
            />
            <Button onClick={searchFiles} size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* 文件列表 */}
          <div className="h-64 overflow-y-auto border rounded">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                目录为空
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.path}-${index}`}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted ${
                      selectedFile?.path === file.path ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      if (file.type === 'directory') {
                        navigateToPath(file.path)
                      } else {
                        readFile(file)
                      }
                    }}
                  >
                    {getFileIcon(file)}
                    <span className="flex-1 text-sm">{file.name}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {file.type === 'file' && (
                        <>
                          <span>{formatFileSize(file.size)}</span>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadFile(file)
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {file.permissions && (
                        <Badge variant="outline" className="text-xs">
                          {file.permissions}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 文件编辑器 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              文件编辑器
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button onClick={saveFile} size="sm">
                      <Save className="h-4 w-4 mr-1" />
                      保存
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false)
                        readFile(selectedFile)
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedFile ? (
            <div className="space-y-4">
              {/* 文件信息 */}
              <div className="text-sm space-y-1">
                <div><strong>文件:</strong> {selectedFile.name}</div>
                <div><strong>路径:</strong> {selectedFile.path}</div>
                {selectedFile.size && (
                  <div><strong>大小:</strong> {formatFileSize(selectedFile.size)}</div>
                )}
                {selectedFile.modified && (
                  <div><strong>修改时间:</strong> {selectedFile.modified}</div>
                )}
              </div>

              {/* 文件内容 */}
              <Textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                readOnly={!isEditing}
                className="h-64 font-mono text-sm"
                placeholder="文件内容将显示在这里..."
              />

              {isEditing && (
                <div className="text-xs text-muted-foreground">
                  正在编辑模式。修改后点击保存按钮。
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>选择一个文件来查看或编辑</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}