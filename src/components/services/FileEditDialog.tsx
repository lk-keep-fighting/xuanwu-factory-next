'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, X, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { serviceSvc } from '@/service/serviceSvc'
import type { K8sFileEntry } from '@/types/k8s'

interface FileEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serviceId: string
  file: K8sFileEntry | null
  onSaveSuccess?: () => void
}

export function FileEditDialog({ 
  open, 
  onOpenChange, 
  serviceId, 
  file, 
  onSaveSuccess 
}: FileEditDialogProps) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 重置状态
  const resetState = () => {
    setContent('')
    setOriginalContent('')
    setError(null)
    setLoading(false)
    setSaving(false)
  }

  // 当对话框打开或文件变化时，加载文件内容
  useEffect(() => {
    if (open && file && serviceId) {
      loadFileContent()
    } else if (!open) {
      resetState()
    }
  }, [open, file, serviceId])

  // 加载文件内容
  const loadFileContent = async () => {
    if (!file || !serviceId) return

    setLoading(true)
    setError(null)

    try {
      // 使用现有的服务API读取文件内容
      const response = await fetch(`/api/services/${serviceId}/files/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '读取文件失败')
      }

      const data = await response.json()
      const fileContent = data.content || ''
      
      setContent(fileContent)
      setOriginalContent(fileContent)
    } catch (error) {
      console.error('Failed to load file content:', error)
      const errorMessage = error instanceof Error ? error.message : '读取文件失败'
      setError(errorMessage)
      toast.error('读取文件失败', {
        description: errorMessage
      })
    } finally {
      setLoading(false)
    }
  }

  // 保存文件内容
  const saveFileContent = async () => {
    if (!file || !serviceId) return

    setSaving(true)
    setError(null)

    try {
      // 使用现有的服务API保存文件内容
      const response = await fetch(`/api/services/${serviceId}/files/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: file.path,
          content: content
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '保存文件失败')
      }

      setOriginalContent(content)
      toast.success('文件保存成功', {
        description: `已保存 ${file.name}`
      })

      // 调用成功回调
      onSaveSuccess?.()
      
      // 关闭对话框
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save file content:', error)
      const errorMessage = error instanceof Error ? error.message : '保存文件失败'
      setError(errorMessage)
      toast.error('保存文件失败', {
        description: errorMessage
      })
    } finally {
      setSaving(false)
    }
  }

  // 检查是否有未保存的更改
  const hasUnsavedChanges = content !== originalContent

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '未知大小'
    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const value = bytes / Math.pow(k, i)
    const decimals = i === 0 ? 0 : value >= 100 ? 1 : 2
    return `${value.toFixed(decimals)} ${units[i]}`
  }

  // 检查文件是否可能是二进制文件
  const isPossiblyBinaryFile = (fileName: string) => {
    const binaryExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.tar', '.gz', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
      '.bin', '.dat', '.db', '.sqlite'
    ]
    const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
    return binaryExtensions.includes(ext)
  }

  const showBinaryWarning = file && isPossiblyBinaryFile(file.name)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            编辑文件
          </DialogTitle>
          <DialogDescription asChild>
            {file ? (
              <div className="flex items-center gap-4 text-sm">
                <span>文件: {file.name}</span>
                <span>路径: {file.path}</span>
                {(file as any).size && (
                  <span>大小: {formatFileSize((file as any).size)}</span>
                )}
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                    未保存
                  </Badge>
                )}
              </div>
            ) : (
              <span>选择文件进行编辑</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {showBinaryWarning && (
            <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              此文件可能是二进制文件，编辑可能导致文件损坏。
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                正在加载文件内容...
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm resize-none"
                placeholder="文件内容将显示在这里..."
                disabled={saving}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            <X className="h-4 w-4 mr-1" />
            取消
          </Button>
          <Button
            onClick={saveFileContent}
            disabled={loading || saving || !hasUnsavedChanges}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}