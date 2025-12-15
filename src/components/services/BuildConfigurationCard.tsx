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
      case BuildType.JAVA_JAR:
        return 'Java JAR包'
      case BuildType.FRONTEND:
        return '前端构建'
      case BuildType.NIXPACKS:
        return 'Nixpacks'
      case BuildType.BUILDPACKS:
        return 'Buildpacks'
      default:
        return buildType
    }
  }

  const renderJavaJarConfig = () => {
    const buildTool = editingBuildArgs.build_tool || 'maven'
    const javaVersion = editingBuildArgs.java_version || '17'
    const runtimeImage = editingBuildArgs.runtime_image || ''
    const javaOptions = editingBuildArgs.java_options || ''

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>构建工具</Label>
            {isEditing ? (
              <Select
                value={buildTool}
                onValueChange={(value) => updateBuildArg('build_tool', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maven">Maven</SelectItem>
                  <SelectItem value="gradle">Gradle</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-gray-900 capitalize">{buildTool}</div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Java版本</Label>
            {isEditing ? (
              <Select
                value={javaVersion}
                onValueChange={(value) => updateBuildArg('java_version', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">Java 8</SelectItem>
                  <SelectItem value="11">Java 11</SelectItem>
                  <SelectItem value="17">Java 17</SelectItem>
                  <SelectItem value="21">Java 21</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-gray-900">Java {javaVersion}</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>运行时镜像</Label>
          {isEditing ? (
            <Select
              value={runtimeImage}
              onValueChange={(value) => updateBuildArg('runtime_image', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择运行时镜像" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openjdk:8-jre-slim">OpenJDK 8 JRE Slim</SelectItem>
                <SelectItem value="openjdk:11-jre-slim">OpenJDK 11 JRE Slim</SelectItem>
                <SelectItem value="nexus.aimstek.cn/aims-common/openjdk:17">OpenJDK 17</SelectItem>
                <SelectItem value="openjdk:21-jre-slim">OpenJDK 21 JRE Slim</SelectItem>
                <SelectItem value="eclipse-temurin:8-jre">Eclipse Temurin 8 JRE</SelectItem>
                <SelectItem value="eclipse-temurin:11-jre">Eclipse Temurin 11 JRE</SelectItem>
                <SelectItem value="eclipse-temurin:17-jre">Eclipse Temurin 17 JRE</SelectItem>
                <SelectItem value="eclipse-temurin:21-jre">Eclipse Temurin 21 JRE</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-gray-900 font-mono">
              {runtimeImage || '未配置'}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>JVM参数</Label>
          {isEditing ? (
            <Input
              value={javaOptions}
              onChange={(e) => updateBuildArg('java_options', e.target.value)}
              placeholder="-Xms512m -Xmx1024m -Dspring.profiles.active=prod"
            />
          ) : (
            <div className="text-sm text-gray-900 font-mono">
              {javaOptions || '无'}
            </div>
          )}
          <p className="text-xs text-gray-500">JVM启动参数和系统属性</p>
        </div>
      </div>
    )
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

  const renderFrontendConfig = () => {
    const frontendFramework = editingBuildArgs.frontend_framework || 'react'
    const nodeVersion = editingBuildArgs.node_version || '18'
    const buildCommand = editingBuildArgs.build_command || 'npm run build'
    const outputDir = editingBuildArgs.output_dir || 'dist'
    const nginxImage = editingBuildArgs.nginx_image || 'nginx:alpine'
    const installCommand = editingBuildArgs.install_command || ''

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>前端框架</Label>
            {isEditing ? (
              <Select
                value={frontendFramework}
                onValueChange={(value) => updateBuildArg('frontend_framework', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="vue">Vue.js</SelectItem>
                  <SelectItem value="angular">Angular</SelectItem>
                  <SelectItem value="nextjs">Next.js</SelectItem>
                  <SelectItem value="nuxtjs">Nuxt.js</SelectItem>
                  <SelectItem value="static">静态HTML</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-gray-900 capitalize">{frontendFramework}</div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Node.js版本</Label>
            {isEditing ? (
              <Select
                value={nodeVersion}
                onValueChange={(value) => updateBuildArg('node_version', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16">Node.js 16</SelectItem>
                  <SelectItem value="18">Node.js 18</SelectItem>
                  <SelectItem value="20">Node.js 20</SelectItem>
                  <SelectItem value="21">Node.js 21</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm text-gray-900">Node.js {nodeVersion}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>构建命令</Label>
            {isEditing ? (
              <Input
                value={buildCommand}
                onChange={(e) => updateBuildArg('build_command', e.target.value)}
                placeholder="npm run build"
              />
            ) : (
              <div className="text-sm text-gray-900 font-mono">{buildCommand}</div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>输出目录</Label>
            {isEditing ? (
              <Input
                value={outputDir}
                onChange={(e) => updateBuildArg('output_dir', e.target.value)}
                placeholder="dist"
              />
            ) : (
              <div className="text-sm text-gray-900 font-mono">{outputDir}</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nginx镜像</Label>
          {isEditing ? (
            <Select
              value={nginxImage}
              onValueChange={(value) => updateBuildArg('nginx_image', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nginx:alpine">Nginx Alpine</SelectItem>
                <SelectItem value="nginx:stable-alpine">Nginx Stable Alpine</SelectItem>
                <SelectItem value="registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine">Nginx Alpine (阿里云)</SelectItem>
                <SelectItem value="registry.cn-hangzhou.aliyuncs.com/library/nginx:stable-alpine">Nginx Stable Alpine (阿里云)</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-gray-900 font-mono">{nginxImage}</div>
          )}
        </div>

        <div className="space-y-2">
          <Label>安装命令</Label>
          {isEditing ? (
            <Input
              value={installCommand}
              onChange={(e) => updateBuildArg('install_command', e.target.value)}
              placeholder="npm install (自动检测)"
            />
          ) : (
            <div className="text-sm text-gray-900 font-mono">
              {installCommand || '自动检测'}
            </div>
          )}
          <p className="text-xs text-gray-500">依赖安装命令，留空则自动检测包管理器</p>
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
                  <SelectItem value={BuildType.JAVA_JAR}>Java JAR包</SelectItem>
                  <SelectItem value={BuildType.FRONTEND}>前端构建</SelectItem>
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
            {editingBuildType === BuildType.JAVA_JAR 
              ? 'Java项目将构建为JAR包，通过运行时镜像部署'
              : editingBuildType === BuildType.FRONTEND
              ? '前端项目将构建为静态文件，通过Nginx镜像部署'
              : editingBuildType === BuildType.TEMPLATE
              ? '基于语言类型选择Dockerfile模板，支持自定义修改'
              : 'Docker镜像构建，包含完整的运行环境'
            }
          </p>
        </div>

        {/* Build Type Specific Configuration */}
        {(isEditing ? editingBuildType : currentBuildType) === BuildType.JAVA_JAR && renderJavaJarConfig()}
        {(isEditing ? editingBuildType : currentBuildType) === BuildType.FRONTEND && renderFrontendConfig()}
        {(isEditing ? editingBuildType : currentBuildType) === BuildType.TEMPLATE && renderTemplateConfig()}
        {(isEditing ? editingBuildType : currentBuildType) === BuildType.DOCKERFILE && renderDockerfileConfig()}

        {/* Custom Build Args */}
        {renderBuildArgs()}
      </CardContent>
    </Card>
  )
})