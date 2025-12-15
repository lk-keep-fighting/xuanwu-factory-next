'use client'

import { memo, useState, useCallback } from 'react'
import { Settings, Save, X, Edit, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { BuildType, ServiceType } from '@/types/project'
import type { Service } from '@/types/project'

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

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>模板ID</Label>
          {isEditing ? (
            <Input
              value={templateId}
              onChange={(e) => updateBuildArg('template_id', e.target.value)}
              placeholder="模板ID (如: pnpm-frontend, maven-java21)"
            />
          ) : (
            <div className="text-sm text-gray-900 font-mono">{templateId || '未指定'}</div>
          )}
          <p className="text-xs text-gray-500">
            可用模板: pnpm-frontend, maven-java21, nginx-static, node18-standard, python-flask
          </p>
        </div>

        <div className="space-y-2">
          <Label>自定义Dockerfile</Label>
          {isEditing ? (
            <textarea
              value={customDockerfile}
              onChange={(e) => updateBuildArg('custom_dockerfile', e.target.value)}
              className="w-full h-32 p-3 text-sm font-mono border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="自定义Dockerfile内容（可选）"
            />
          ) : (
            <div className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded border max-h-32 overflow-y-auto">
              {customDockerfile ? (
                <pre className="whitespace-pre-wrap">{customDockerfile}</pre>
              ) : (
                <span className="text-gray-500">使用默认模板</span>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">
            留空则使用基于模板ID的默认Dockerfile，或使用项目中现有的Dockerfile
          </p>
        </div>
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