'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="database-name">数据库名</Label>
                <Input
                  id="database-name"
                  value={databaseNameInputValue}
                  onChange={(e) => onUpdateService({ database_name: e.target.value })}
                  disabled={!isEditing}
                  placeholder="mydb"
                />
                <p className="text-xs text-gray-500">初始创建的数据库名称</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-username">用户名</Label>
                <Input
                  id="database-username"
                  value={databaseUsernameValue}
                  onChange={(e) => onUpdateService({ username: e.target.value })}
                  disabled={!isEditing}
                  placeholder="admin"
                />
                <p className="text-xs text-gray-500">数据库用户名</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="database-password">用户密码</Label>
                <Input
                  id="database-password"
                  type="password"
                  value={databasePasswordValue}
                  onChange={(e) => onUpdateService({ password: e.target.value })}
                  disabled={!isEditing}
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-500">数据库用户密码</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-root-password">Root 密码</Label>
                <Input
                  id="database-root-password"
                  type="password"
                  value={databaseRootPasswordValue}
                  onChange={(e) => onUpdateService({ root_password: e.target.value })}
                  disabled={!isEditing}
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-500">MySQL root 用户密码</p>
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
            <div className="space-y-2">
              <Label htmlFor="internal-host">内部主机名</Label>
              <Input
                id="internal-host"
                value={dbService?.internal_host || '-'}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">集群内部访问地址</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                value={dbService?.port || '-'}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">数据库服务端口</p>
            </div>
          </div>
          {dbService?.internal_connection_url && (
            <div className="space-y-2">
              <Label htmlFor="connection-url">连接字符串</Label>
              <Input
                id="connection-url"
                value={dbService.internal_connection_url}
                disabled
                className="bg-gray-50 font-mono text-xs"
              />
              <p className="text-xs text-gray-500">内部连接 URL（自动生成）</p>
            </div>
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
