'use client'

import { useState, useEffect } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { DockerfileTemplate } from '@/types/project'

interface DockerfileTemplateDialogProps {
  template?: DockerfileTemplate | null
  open: boolean
  onClose: () => void
  onSave: () => Promise<void>
}

interface TemplateFormData {
  id: string
  name: string
  description: string
  category: string
  baseImage: string
  workdir: string
  copyFiles: string[]
  installCommands: string[]
  buildCommands: string[]
  runCommand: string
  exposePorts: number[]
  envVars: Record<string, string>
  dockerfile: string
}

const DEFAULT_CATEGORIES = ['前端', 'Java', 'Node.js', 'Python', '自定义']

export function DockerfileTemplateDialog({
  template,
  open,
  onClose,
  onSave
}: DockerfileTemplateDialogProps) {
  const [formData, setFormData] = useState<TemplateFormData>({
    id: '',
    name: '',
    description: '',
    category: '自定义',
    baseImage: '',
    workdir: '/app',
    copyFiles: ['.'],
    installCommands: [],
    buildCommands: [],
    runCommand: '',
    exposePorts: [],
    envVars: {},
    dockerfile: ''
  })
  const [saving, setSaving] = useState(false)
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')

  const isEditing = !!template

  // 初始化表单数据
  useEffect(() => {
    if (template) {
      setFormData({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        baseImage: template.baseImage,
        workdir: template.workdir,
        copyFiles: [...template.copyFiles],
        installCommands: [...template.installCommands],
        buildCommands: [...template.buildCommands],
        runCommand: template.runCommand,
        exposePorts: [...template.exposePorts],
        envVars: { ...template.envVars },
        dockerfile: template.dockerfile
      })
    } else {
      // 重置为默认值
      setFormData({
        id: '',
        name: '',
        description: '',
        category: '自定义',
        baseImage: '',
        workdir: '/app',
        copyFiles: ['.'],
        installCommands: [],
        buildCommands: [],
        runCommand: '',
        exposePorts: [],
        envVars: {},
        dockerfile: ''
      })
    }
  }, [template])

  // 更新表单字段
  const updateField = (field: keyof TemplateFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // 添加数组项
  const addArrayItem = (field: 'copyFiles' | 'installCommands' | 'buildCommands' | 'exposePorts', value: string | number) => {
    if (!value) return
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], value]
    }))
  }

  // 删除数组项
  const removeArrayItem = (field: 'copyFiles' | 'installCommands' | 'buildCommands' | 'exposePorts', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  // 添加环境变量
  const addEnvVar = () => {
    if (!newEnvKey || !newEnvValue) return
    setFormData(prev => ({
      ...prev,
      envVars: { ...prev.envVars, [newEnvKey]: newEnvValue }
    }))
    setNewEnvKey('')
    setNewEnvValue('')
  }

  // 删除环境变量
  const removeEnvVar = (key: string) => {
    setFormData(prev => {
      const newEnvVars = { ...prev.envVars }
      delete newEnvVars[key]
      return { ...prev, envVars: newEnvVars }
    })
  }

  // 生成Dockerfile
  const generateDockerfile = () => {
    const lines = []
    
    lines.push(`# ${formData.name}`)
    lines.push(`# ${formData.description}`)
    lines.push('')
    lines.push(`FROM ${formData.baseImage}`)
    lines.push('')
    lines.push(`WORKDIR ${formData.workdir}`)
    lines.push('')

    // 环境变量
    if (Object.keys(formData.envVars).length > 0) {
      lines.push('# 设置环境变量')
      Object.entries(formData.envVars).forEach(([key, value]) => {
        lines.push(`ENV ${key}="${value}"`)
      })
      lines.push('')
    }

    // 复制文件
    if (formData.copyFiles.length > 0) {
      lines.push('# 复制文件')
      formData.copyFiles.forEach(file => {
        lines.push(`COPY ${file} ./`)
      })
      lines.push('')
    }

    // 安装命令
    if (formData.installCommands.length > 0) {
      lines.push('# 安装依赖')
      formData.installCommands.forEach(cmd => {
        lines.push(`RUN ${cmd}`)
      })
      lines.push('')
    }

    // 构建命令
    if (formData.buildCommands.length > 0) {
      lines.push('# 构建应用')
      formData.buildCommands.forEach(cmd => {
        lines.push(`RUN ${cmd}`)
      })
      lines.push('')
    }

    // 暴露端口
    if (formData.exposePorts.length > 0) {
      lines.push('# 暴露端口')
      formData.exposePorts.forEach(port => {
        lines.push(`EXPOSE ${port}`)
      })
      lines.push('')
    }

    // 启动命令
    if (formData.runCommand) {
      lines.push('# 启动应用')
      if (formData.runCommand.includes(' ')) {
        const parts = formData.runCommand.split(' ')
        lines.push(`CMD [${parts.map(p => `"${p}"`).join(', ')}]`)
      } else {
        lines.push(`CMD ["${formData.runCommand}"]`)
      }
    }

    const dockerfile = lines.join('\n')
    updateField('dockerfile', dockerfile)
  }

  // 保存模版
  const handleSave = async () => {
    try {
      setSaving(true)

      // 验证必需字段
      if (!formData.name || !formData.description || !formData.baseImage || !formData.runCommand) {
        alert('请填写所有必需字段')
        return
      }

      const url = isEditing 
        ? `/api/dockerfile-templates/${formData.id}`
        : '/api/dockerfile-templates'
      
      const method = isEditing ? 'PUT' : 'POST'

      const requestData = {
        id: formData.id || `custom-${Date.now()}`,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        base_image: formData.baseImage,
        workdir: formData.workdir,
        copy_files: formData.copyFiles,
        install_commands: formData.installCommands,
        build_commands: formData.buildCommands,
        run_command: formData.runCommand,
        expose_ports: formData.exposePorts,
        env_vars: formData.envVars,
        dockerfile_content: formData.dockerfile
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        await onSave()
      } else {
        const data = await response.json()
        alert(`保存失败: ${data.error}`)
      }
    } catch (error) {
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '编辑模版' : '新建模版'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">模版名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="输入模版名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">分类 *</Label>
              <Select value={formData.category} onValueChange={(value) => updateField('category', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述 *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="输入模版描述"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseImage">基础镜像 *</Label>
              <Input
                id="baseImage"
                value={formData.baseImage}
                onChange={(e) => updateField('baseImage', e.target.value)}
                placeholder="例如: node:18-alpine"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workdir">工作目录</Label>
              <Input
                id="workdir"
                value={formData.workdir}
                onChange={(e) => updateField('workdir', e.target.value)}
                placeholder="/app"
              />
            </div>
          </div>

          {/* 复制文件 */}
          <div className="space-y-2">
            <Label>复制文件</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入文件路径"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addArrayItem('copyFiles', e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                  addArrayItem('copyFiles', input.value)
                  input.value = ''
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.copyFiles.map((file, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {file}
                  <button onClick={() => removeArrayItem('copyFiles', index)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* 安装命令 */}
          <div className="space-y-2">
            <Label>安装命令</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入安装命令"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addArrayItem('installCommands', e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                  addArrayItem('installCommands', input.value)
                  input.value = ''
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.installCommands.map((cmd, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {cmd}
                  <button onClick={() => removeArrayItem('installCommands', index)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* 构建命令 */}
          <div className="space-y-2">
            <Label>构建命令</Label>
            <div className="flex gap-2">
              <Input
                placeholder="输入构建命令"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addArrayItem('buildCommands', e.currentTarget.value)
                    e.currentTarget.value = ''
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement
                  addArrayItem('buildCommands', input.value)
                  input.value = ''
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.buildCommands.map((cmd, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {cmd}
                  <button onClick={() => removeArrayItem('buildCommands', index)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* 运行命令和端口 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="runCommand">启动命令 *</Label>
              <Input
                id="runCommand"
                value={formData.runCommand}
                onChange={(e) => updateField('runCommand', e.target.value)}
                placeholder="例如: npm start"
              />
            </div>
            <div className="space-y-2">
              <Label>暴露端口</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="端口号"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const port = parseInt(e.currentTarget.value)
                      if (port > 0) {
                        addArrayItem('exposePorts', port)
                        e.currentTarget.value = ''
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement
                    const port = parseInt(input.value)
                    if (port > 0) {
                      addArrayItem('exposePorts', port)
                      input.value = ''
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.exposePorts.map((port, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {port}
                    <button onClick={() => removeArrayItem('exposePorts', index)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* 环境变量 */}
          <div className="space-y-2">
            <Label>环境变量</Label>
            <div className="flex gap-2">
              <Input
                placeholder="变量名"
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
              />
              <Input
                placeholder="变量值"
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addEnvVar()
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addEnvVar}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(formData.envVars).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="flex items-center gap-1">
                  {key}={value}
                  <button onClick={() => removeEnvVar(key)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Dockerfile内容 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="dockerfile">Dockerfile内容</Label>
              <Button type="button" variant="outline" size="sm" onClick={generateDockerfile}>
                自动生成
              </Button>
            </div>
            <Textarea
              id="dockerfile"
              value={formData.dockerfile}
              onChange={(e) => updateField('dockerfile', e.target.value)}
              placeholder="Dockerfile内容将在这里显示"
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}