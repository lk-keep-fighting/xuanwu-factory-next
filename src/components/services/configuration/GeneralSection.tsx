'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ServiceType, DatabaseType, DATABASE_TYPE_METADATA, type SupportedDatabaseType } from '@/types/project'
import type { Service, DatabaseService, Project } from '@/types/project'

interface GeneralSectionProps {
  service: Service
  project: Project | null
  isEditing: boolean
  editedService: Partial<Service>
  onUpdateService: (updates: Partial<Service>) => void
}

/**
 * 判断服务是否已部署
 * 已部署的服务包括：运行中、构建中、已停止
 * 只有 pending 和 error 状态的服务可以修改初始化配置
 */
const isServiceDeployed = (service: Service): boolean => {
  return service.status === 'running' || 
         service.status === 'building' ||
         service.status === 'stopped'
}

/**
 * General Section Component
 * 
 * Displays service-type specific configuration:
 * - Application: Git configuration, build settings
 * - Database: Database type, version, credentials
 * - Image: Image name and tag
 */
export function GeneralSection({
  service,
  project,
  isEditing,
  editedService,
  onUpdateService
}: GeneralSectionProps) {
  const serviceType = service.type
  const isDeployed = isServiceDeployed(service)

  // Application Service Configuration
  if (serviceType === ServiceType.APPLICATION) {
    const appService = service as any
    const editedAppService = editedService as any

    return (
      <div className="space-y-6">
        {/* Git Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Git 配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="git-repository">仓库 URL</Label>
              <Input
                id="git-repository"
                value={appService.git_repository || ''}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">Git 仓库地址（创建后不可修改）</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-branch">分支</Label>
              <Input
                id="git-branch"
                value={isEditing ? (editedAppService.git_branch || 'main') : (appService.git_branch || 'main')}
                onChange={(e) => onUpdateService({ git_branch: e.target.value })}
                disabled={!isEditing}
                placeholder="main"
              />
              <p className="text-xs text-gray-500">要构建和部署的分支</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-path">项目路径</Label>
            <Input
              id="git-path"
              value={isEditing ? (editedAppService.git_path || '/') : (appService.git_path || '/')}
              onChange={(e) => onUpdateService({ git_path: e.target.value })}
              disabled={!isEditing}
              placeholder="/"
            />
            <p className="text-xs text-gray-500">Monorepo 中的项目路径，默认为根目录</p>
          </div>
        </div>

        {/* Build Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">构建配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="build-type">构建方式</Label>
              <Input
                id="build-type"
                value={appService.build_type || 'dockerfile'}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">构建方式（创建后不可修改）</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dockerfile-path">Dockerfile 路径</Label>
              <Input
                id="dockerfile-path"
                value={isEditing ? (editedAppService.dockerfile_path || 'Dockerfile') : (appService.dockerfile_path || 'Dockerfile')}
                onChange={(e) => onUpdateService({ dockerfile_path: e.target.value })}
                disabled={!isEditing}
                placeholder="Dockerfile"
              />
              <p className="text-xs text-gray-500">Dockerfile 相对于项目路径的位置</p>
            </div>
          </div>
        </div>

        {/* Deployment Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">部署配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="port">容器端口</Label>
              <Input
                id="port"
                type="number"
                value={isEditing ? (editedAppService.port || '') : (appService.port || '')}
                onChange={(e) => onUpdateService({ port: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                disabled={!isEditing}
                placeholder="8080"
              />
              <p className="text-xs text-gray-500">应用监听的端口号</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replicas">副本数</Label>
              <Input
                id="replicas"
                type="number"
                min="0"
                value={isEditing ? (editedAppService.replicas ?? 1) : (appService.replicas ?? 1)}
                onChange={(e) => onUpdateService({ replicas: e.target.value ? parseInt(e.target.value, 10) : 1 })}
                disabled={!isEditing}
                placeholder="1"
              />
              <p className="text-xs text-gray-500">运行的 Pod 副本数量</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="command">启动命令（可选）</Label>
            <Input
              id="command"
              value={isEditing ? (editedAppService.command || '') : (appService.command || '')}
              onChange={(e) => onUpdateService({ command: e.target.value })}
              disabled={!isEditing}
              placeholder="npm start"
            />
            <p className="text-xs text-gray-500">覆盖容器的默认启动命令</p>
          </div>
        </div>
      </div>
    )
  }

  // Database Service Configuration
  if (serviceType === ServiceType.DATABASE) {
    const dbService = service as DatabaseService
    const editedDbService = editedService as DatabaseService

    const normalizedDatabaseType = (() => {
      const rawType = dbService?.database_type
      return typeof rawType === 'string' ? rawType.toLowerCase() : ''
    })()

    const isMysqlDatabase = normalizedDatabaseType === DatabaseType.MYSQL
    const isRedisDatabase = normalizedDatabaseType === DatabaseType.REDIS
    const supportedDatabaseType: SupportedDatabaseType | null =
      isMysqlDatabase || isRedisDatabase ? (normalizedDatabaseType as SupportedDatabaseType) : null

    const databaseTypeLabel = supportedDatabaseType
      ? DATABASE_TYPE_METADATA[supportedDatabaseType].label
      : dbService?.database_type ?? '-'

    const databaseUsernameValue =
      (isEditing ? editedDbService?.username : dbService?.username) ?? ''
    const databasePasswordValue =
      (isEditing ? editedDbService?.password : dbService?.password) ?? ''
    const databaseRootPasswordValue =
      (isEditing ? editedDbService?.root_password : dbService?.root_password) ?? ''
    const databaseNameInputValue = isEditing
      ? editedDbService?.database_name ?? dbService?.database_name ?? ''
      : dbService?.database_name ?? '-'
    const databaseVersionValue = dbService?.version ?? 'latest'
    const databaseVolumeSizeValue = dbService?.volume_size ?? '10Gi'
    const databaseVolumeSizeInputValue = isEditing
      ? editedDbService?.volume_size ?? databaseVolumeSizeValue
      : databaseVolumeSizeValue

    return (
      <div className="space-y-6">
        {/* Database Type and Version */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">数据库信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="database-type">数据库类型</Label>
              <Input
                id="database-type"
                value={databaseTypeLabel}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">数据库类型（创建后不可修改）</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="database-version">版本</Label>
              <Input
                id="database-version"
                value={databaseVersionValue}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">数据库版本（创建后不可修改）</p>
            </div>
          </div>
        </div>

        {/* MySQL Specific Configuration */}
        {isMysqlDatabase && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">MySQL 配置</h3>
            
            {/* 部署后不可修改的提示 */}
            {isDeployed && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <div className="text-sm text-amber-800">
                    ⚠️ <strong>部署后不可修改：</strong>数据库名、Root 密码、用户名和密码在初始化后无法通过界面修改。
                    如需修改，请在 MySQL 内部使用 SQL 命令操作。
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="database-name">数据库名</Label>
                <Input
                  id="database-name"
                  value={databaseNameInputValue}
                  onChange={(e) => onUpdateService({ database_name: e.target.value })}
                  disabled={!isEditing || isDeployed}
                  className={isDeployed ? 'bg-gray-100 cursor-not-allowed' : ''}
                  placeholder="mydb"
                />
                <p className="text-xs text-gray-500">
                  初始创建的数据库名称
                  {isDeployed && <span className="text-amber-600"> （部署后不可修改）</span>}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-root-password">Root 密码</Label>
                <Input
                  id="database-root-password"
                  type="password"
                  value={databaseRootPasswordValue}
                  onChange={(e) => onUpdateService({ root_password: e.target.value })}
                  disabled={!isEditing || isDeployed}
                  className={isDeployed ? 'bg-gray-100 cursor-not-allowed' : ''}
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-500">
                  MySQL root 用户密码
                  {isDeployed && <span className="text-amber-600"> （部署后不可修改）</span>}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="database-username">自定义用户名</Label>
                <Input
                  id="database-username"
                  value={databaseUsernameValue}
                  onChange={(e) => onUpdateService({ username: e.target.value })}
                  disabled={!isEditing || isDeployed}
                  className={isDeployed ? 'bg-gray-100 cursor-not-allowed' : ''}
                  placeholder="admin"
                />
                {isDeployed && (
                  <p className="text-xs text-amber-600">部署后不可修改</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-password">自定义用户密码</Label>
                <Input
                  id="database-password"
                  type="password"
                  value={databasePasswordValue}
                  onChange={(e) => onUpdateService({ password: e.target.value })}
                  disabled={!isEditing || isDeployed}
                  className={isDeployed ? 'bg-gray-100 cursor-not-allowed' : ''}
                  placeholder="••••••••"
                />
                {isDeployed && (
                  <p className="text-xs text-amber-600">部署后不可修改</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Redis Specific Configuration */}
        {isRedisDatabase && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Redis 配置</h3>
            <div className="space-y-2">
              <Label htmlFor="database-password">密码（可选）</Label>
              <Input
                id="database-password"
                type="password"
                value={databasePasswordValue}
                onChange={(e) => onUpdateService({ password: e.target.value })}
                disabled={!isEditing}
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500">Redis 访问密码，留空表示无密码</p>
            </div>
          </div>
        )}

        {/* Storage Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">存储配置</h3>
          <div className="space-y-2">
            <Label htmlFor="volume-size">存储大小</Label>
            <Input
              id="volume-size"
              value={databaseVolumeSizeInputValue}
              onChange={(e) => onUpdateService({ volume_size: e.target.value })}
              disabled={!isEditing}
              placeholder="10Gi"
            />
            <p className="text-xs text-gray-500">持久化存储大小，如 10Gi、20Gi</p>
          </div>
        </div>

        {/* Connection Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">连接信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CopyableField
              label="内部主机名"
              value={dbService?.internal_host || '-'}
              description="集群内部访问地址"
            />
            <CopyableField
              label="端口"
              value={dbService?.port?.toString() || '-'}
              description="数据库服务端口"
            />
          </div>
          {dbService?.internal_connection_url && (
            <ConnectionUrlDisplay url={dbService.internal_connection_url} />
          )}
        </div>
      </div>
    )
  }

  // Image Service Configuration
  if (serviceType === ServiceType.IMAGE) {
    const imageService = service as any
    const editedImageService = editedService as any

    return (
      <div className="space-y-6">
        {/* Image Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">镜像配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="image">镜像名称</Label>
              <Input
                id="image"
                value={isEditing ? (editedImageService.image || '') : (imageService.image || '')}
                onChange={(e) => onUpdateService({ image: e.target.value })}
                disabled={!isEditing}
                placeholder="nginx"
              />
              <p className="text-xs text-gray-500">Docker 镜像名称，如 nginx、redis</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">镜像标签</Label>
              <Input
                id="tag"
                value={isEditing ? (editedImageService.tag || 'latest') : (imageService.tag || 'latest')}
                onChange={(e) => onUpdateService({ tag: e.target.value })}
                disabled={!isEditing}
                placeholder="latest"
              />
              <p className="text-xs text-gray-500">镜像版本标签</p>
            </div>
          </div>
        </div>

        {/* Deployment Configuration */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">部署配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="replicas">副本数</Label>
              <Input
                id="replicas"
                type="number"
                min="0"
                value={isEditing ? (editedImageService.replicas ?? 1) : (imageService.replicas ?? 1)}
                onChange={(e) => onUpdateService({ replicas: e.target.value ? parseInt(e.target.value, 10) : 1 })}
                disabled={!isEditing}
                placeholder="1"
              />
              <p className="text-xs text-gray-500">运行的 Pod 副本数量</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="command">启动命令（可选）</Label>
              <Input
                id="command"
                value={isEditing ? (editedImageService.command || '') : (imageService.command || '')}
                onChange={(e) => onUpdateService({ command: e.target.value })}
                disabled={!isEditing}
                placeholder="nginx -g 'daemon off;'"
              />
              <p className="text-xs text-gray-500">覆盖容器的默认启动命令</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fallback for unknown service types
  return (
    <div className="text-sm text-gray-500">
      未知的服务类型：{serviceType}
    </div>
  )
}

/**
 * 可复制字段组件
 * 用于显示只读信息，支持一键复制
 */
function CopyableField({ 
  label, 
  value, 
  description 
}: { 
  label: string
  value: string
  description?: string 
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (value === '-') return
    
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          readOnly
          className="bg-gray-50 flex-1"
        />
        {value !== '-' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 px-2"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  )
}

/**
 * 连接 URL 显示组件
 * 使用 Input 组件展示，带复制按钮
 */
function ConnectionUrlDisplay({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('复制失败')
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="connection-url">连接字符串</Label>
      <div className="flex gap-2">
        <Input
          id="connection-url"
          value={url}
          readOnly
          className="bg-gray-50 font-mono text-xs flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              已复制
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1" />
              复制
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        内部连接 URL（自动生成），点击复制按钮获取完整字符串
      </p>
    </div>
  )
}
