'use client'

import { Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { DockerfileTemplate } from '@/types/project'

interface DockerfileTemplateViewDialogProps {
  template: DockerfileTemplate | null
  open: boolean
  onClose: () => void
}

export function DockerfileTemplateViewDialog({
  template,
  open,
  onClose
}: DockerfileTemplateViewDialogProps) {
  if (!template) return null

  // 复制Dockerfile到剪贴板
  const copyDockerfile = async () => {
    try {
      await navigator.clipboard.writeText(template.dockerfile)
      // 这里可以添加一个toast通知
      alert('Dockerfile已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
      alert('复制失败')
    }
  }

  // 下载Dockerfile文件
  const downloadDockerfile = () => {
    const blob = new Blob([template.dockerfile], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Dockerfile-${template.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template.name}
            <Badge variant="secondary">{template.category}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-1">描述</h3>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">基础镜像</h3>
                <p className="text-sm text-gray-600 font-mono">{template.baseImage}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">工作目录</h3>
                <p className="text-sm text-gray-600 font-mono">{template.workdir}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* 详细配置 */}
          <div className="grid grid-cols-2 gap-6">
            {/* 左列 */}
            <div className="space-y-4">
              {/* 复制文件 */}
              {template.copyFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">复制文件</h3>
                  <div className="flex flex-wrap gap-1">
                    {template.copyFiles.map((file, index) => (
                      <Badge key={index} variant="outline" className="font-mono text-xs">
                        {file}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 安装命令 */}
              {template.installCommands.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">安装命令</h3>
                  <div className="space-y-1">
                    {template.installCommands.map((cmd, index) => (
                      <div key={index} className="text-xs font-mono bg-gray-50 p-2 rounded">
                        {cmd}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 构建命令 */}
              {template.buildCommands.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">构建命令</h3>
                  <div className="space-y-1">
                    {template.buildCommands.map((cmd, index) => (
                      <div key={index} className="text-xs font-mono bg-gray-50 p-2 rounded">
                        {cmd}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 右列 */}
            <div className="space-y-4">
              {/* 启动命令 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">启动命令</h3>
                <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                  {template.runCommand}
                </div>
              </div>

              {/* 暴露端口 */}
              {template.exposePorts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">暴露端口</h3>
                  <div className="flex flex-wrap gap-1">
                    {template.exposePorts.map((port, index) => (
                      <Badge key={index} variant="outline" className="font-mono">
                        {port}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 环境变量 */}
              {Object.keys(template.envVars).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">环境变量</h3>
                  <div className="space-y-1">
                    {Object.entries(template.envVars).map(([key, value]) => (
                      <div key={key} className="text-xs font-mono bg-gray-50 p-2 rounded">
                        {key}={value}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Dockerfile内容 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">Dockerfile内容</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyDockerfile}>
                  <Copy className="h-4 w-4 mr-1" />
                  复制
                </Button>
                <Button variant="outline" size="sm" onClick={downloadDockerfile}>
                  <Download className="h-4 w-4 mr-1" />
                  下载
                </Button>
              </div>
            </div>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {template.dockerfile}
              </pre>
            </div>
          </div>

          {/* 关闭按钮 */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}