'use client'

import { memo, useState, useCallback } from 'react'
import { Settings, Save, X, Edit, Wrench, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { BuildType, ServiceType } from '@/types/project'
import type { Service } from '@/types/project'
import { useDockerfileTemplates } from '@/hooks/useDockerfileTemplates'

interface BuildConfigurationCardProps {
  service: Service
  isEditing: boolean
  onStartEdit: () => void
  onSave: (buildConfig: BuildConfiguration) => Promise<void>
  onCancel: () => void
}

interface BuildConfiguration {
  build_type: BuildType
  build_args: Record<string, string>
}

/**
 * BuildConfigurationCard - Component for viewing and editing build configuration
 * Supports both Dockerfile and Java JAR build types
 */
export const BuildConfigurationCard = memo(function BuildConfigurationCard({
  service,
  isEditing,
  onStartEdit,
  onSave,
  onCancel
}: BuildConfigurationCardProps) {
  const isApplicationService = service.type === ServiceType.APPLICATION
  
  // Use the template hook
  const { templates, categories, loading: templatesLoading, getTemplateById } = useDockerfileTemplates()
  
  if (!isApplicationService) {
    return null
  }

  const applicationService = service as any
  const currentBuildType = applicationService.build_type || BuildType.DOCKERFILE
  const currentBuildArgs = applicationService.build_args || {}
  
  // Local state for editing
  const [editingBuildType, setEditingBuildType] = useState<BuildType>(currentBuildType)
  const [editingBuildArgs, setEditingBuildArgs] = useState<Record<string, string>>(currentBuildArgs)
  const [saving, setSaving] = useState(false)

  // Reset editing state when editing mode changes
  const handleStartEdit = useCallback(() => {
    setEditingBuildType(currentBuildType)
    setEditingBuildArgs({ ...currentBuildArgs })
    onStartEdit()
  }, [currentBuildType, currentBuildArgs, onStartEdit])

  const handleCancel = useCallback(() => {
    setEditingBuildType(currentBuildType)
    setEditingBuildArgs({ ...currentBuildArgs })
    onCancel()
  }, [currentBuildType, currentBuildArgs, onCancel])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      await onSave({
        build_type: editingBuildType,
        build_args: editingBuildArgs
      })
    } finally {
      setSaving(false)
    }
  }, [editingBuildType, editingBuildArgs, onSave])

  const updateBuildArg = useCallback((key: string, value: string) => {
    setEditingBuildArgs(prev => ({
      ...prev,
      [key]: value
    }))
  }, [])

  const getBuildTypeLabel = (buildType: BuildType) => {
    switch (buildType) {
      case BuildType.DOCKERFILE:
        return 'Dockerfile'
      case BuildType.TEMPLATE:
        return '模板构建'
      default:
        return buildType
    }
  }

  const renderDockerfileConfig = () => {
    const dockerfilePath = editingBuildArgs.dockerfile_path || applicationService.dockerfile_path || 'Dockerfile'

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Dockerfile路径</Label>
          {isEditing ? (
            <Input
              value={dockerfilePath}
              onChange={(e) => updateBuildArg('dockerfile_path', e.target.value)}
              placeholder="Dockerfile"
            />
          ) : (
            <div className="text-sm text-gray-900 font-mono">{dockerfilePath}</div>
          )}
        </div>
      </div>
    )
  }

  const renderTemplateConfig = () => {
    const templateId = editingBuildArgs.template_id || ''
    const customDockerfile = editingBuildArgs.custom_dockerfile || ''
    const selectedTemplate = templateId ? getTemplateById(templateId) : null

    const handleTemplateSelect = (newTemplateId: string) => {
      const template = getTemplateById(newTemplateId)
      if (template) {
        updateBuildArg('template_id', template.id)
        updateBuildArg('custom_dockerfile', template.dockerfile)
      }
    }

    const handleResetToTemplate = () => {
      if (selectedTemplate) {
        updateBuildArg('custom_dockerfile', selectedTemplate.dockerfile)
      }
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>选择构建模板</Label>
          {isEditing ? (
            <Select
              value={templateId}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择模板" />
              </SelectTrigger>
              <SelectContent>
                {templatesLoading ? (
                  <div className="px-2 py-1 text-sm text-gray-500">加载模板中...</div>
                ) : categories.map((category) => (
                  <div key={category.value}>
                    <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100">
                      {category.label} ({category.count})
                    </div>
                    {templates
                      .filter(template => template.category === category.value)
                      .map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{template.name}</span>
                            <span className="text-xs text-gray-500">{template.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-900">
                {selectedTemplate ? (
                  <div className="flex flex-col">
                    <span className="font-medium">{selectedTemplate.name}</span>
                    <span className="text-xs text-gray-500">{selectedTemplate.description}</span>
                  </div>
                ) : (
                  <span className="text-gray-500">未选择模板</span>
                )}
              </div>
              {selectedTemplate && (
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplate.category}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>自定义Dockerfile</Label>
            {isEditing && selectedTemplate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToTemplate}
                className="gap-1 text-xs h-6 px-2"
              >
                <RefreshCw className="h-3 w-3" />
                重置为模板
              </Button>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={customDockerfile}
              onChange={(e) => updateBuildArg('custom_dockerfile', e.target.value)}
              className="w-full h-40 p-3 text-sm font-mono border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="自定义Dockerfile内容（选择模板后自动填充）"
            />
          ) : (
            <div className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border max-h-40 overflow-y-auto">
              {customDockerfile ? (
                <pre className="whitespace-pre-wrap">{customDockerfile}</pre>
              ) : (
                <span className="text-gray-500">使用默认模板</span>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">
            选择模板后会自动填充Dockerfile内容，您可以根据需要进行修改
          </p>
        </div>

        {selectedTemplate && (
          <div className="space-y-2">
            <Label>模板信息</Label>
            <div className="bg-blue-50 p-3 rounded-md text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium text-gray-600">基础镜像:</span>
                  <div className="font-mono text-gray-900">{selectedTemplate.baseImage}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">工作目录:</span>
                  <div className="font-mono text-gray-900">{selectedTemplate.workdir}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">暴露端口:</span>
                  <div className="font-mono text-gray-900">{selectedTemplate.exposePorts.join(', ')}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">启动命令:</span>
                  <div className="font-mono text-gray-900">{selectedTemplate.runCommand}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderBuildArgs = () => {
    // Filter out special build args that are handled separately
    const specialArgs = [
      // Java JAR args
      'build_tool', 'java_version', 'runtime_image', 'java_options',
      // Frontend args
      'frontend_framework', 'node_version', 'build_command', 'output_dir', 'nginx_image', 'install_command',
      // Template args
      'template_id', 'custom_dockerfile',
      // Common args
      'dockerfile_path'
    ]
    const customBuildArgs = Object.entries(editingBuildArgs).filter(([key]) => 
      !specialArgs.includes(key)
    )

    if (customBuildArgs.length === 0 && !isEditing) {
      return null
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>自定义构建参数</Label>
        </div>
        
        {customBuildArgs.length === 0 ? (
          <div className="text-sm text-gray-500">无自定义构建参数</div>
        ) : (
          <div className="space-y-2">
            {customBuildArgs.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="text-sm font-mono text-gray-700 min-w-0 flex-1">
                  {key}
                </div>
                <div className="text-sm text-gray-900 min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      value={value}
                      onChange={(e) => updateBuildArg(key, e.target.value)}
                      placeholder="值"
                    />
                  ) : (
                    <span className="font-mono">{value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            构建配置
          </CardTitle>
          <CardDescription className="text-xs">
            查看和编辑服务的构建配置参数
          </CardDescription>
        </div>
        {!isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            编辑
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Build Type */}
        <div className="space-y-2">
          <Label>构建方式</Label>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Select
                value={editingBuildType}
                onValueChange={(value) => setEditingBuildType(value as BuildType)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BuildType.DOCKERFILE}>Dockerfile</SelectItem>
                  <SelectItem value={BuildType.TEMPLATE}>模板构建</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Settings className="h-3 w-3" />
                {getBuildTypeLabel(currentBuildType)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {editingBuildType === BuildType.TEMPLATE
              ? '基于公司模板选择Dockerfile模板，支持自定义修改'
              : 'Docker镜像构建，包含完整的运行环境'
            }
          </p>
        </div>

        {/* Build Type Specific Configuration */}
        {(isEditing ? editingBuildType : currentBuildType) === BuildType.TEMPLATE && renderTemplateConfig()}
        {(isEditing ? editingBuildType : currentBuildType) === BuildType.DOCKERFILE && renderDockerfileConfig()}

        {/* Custom Build Args */}
        {renderBuildArgs()}
      </CardContent>
    </Card>
  )
})