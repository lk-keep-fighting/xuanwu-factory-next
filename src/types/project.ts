// 项目类型定义
export interface Project {
  id?: string
  name: string
  identifier: string
  description?: string
  created_at?: string
  updated_at?: string
}

// 服务类型枚举
export enum ServiceType {
  APPLICATION = 'application',  // 基于源码构建
  DATABASE = 'database',        // 内置数据库镜像
  IMAGE = 'image'               // 基于现有镜像部署
}

// 数据库类型枚举
export enum DatabaseType {
  MYSQL = 'mysql',
  REDIS = 'redis',
  POSTGRESQL = 'postgresql',
  MONGODB = 'mongodb',
  MARIADB = 'mariadb'
}

export const SUPPORTED_DATABASE_TYPES = [DatabaseType.MYSQL, DatabaseType.REDIS] as const

export type SupportedDatabaseType = (typeof SUPPORTED_DATABASE_TYPES)[number]

export const DATABASE_TYPE_METADATA: Record<SupportedDatabaseType, { label: string; defaultPort: number }> = {
  [DatabaseType.MYSQL]: { label: 'MySQL', defaultPort: 3306 },
  [DatabaseType.REDIS]: { label: 'Redis', defaultPort: 6379 }
} as const

// Git 提供商
export enum GitProvider {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  BITBUCKET = 'bitbucket',
  GITEA = 'gitea'
}

// 构建类型
export enum BuildType {
  DOCKERFILE = 'dockerfile',
  NIXPACKS = 'nixpacks',
  BUILDPACKS = 'buildpacks'
}

// 网络配置类型
export interface NetworkDomainConfig {
  enabled: boolean
  prefix: string
  host: string
}

export interface NetworkPortConfig {
  name?: string
  container_port: number
  service_port?: number
  protocol?: 'TCP' | 'UDP'
  node_port?: number
  domain?: NetworkDomainConfig
}

export interface NetworkConfigV2 {
  service_type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'Headless'
  ports: NetworkPortConfig[]
  headless_service_enabled?: boolean
}

export interface LegacyNetworkConfig {
  container_port: number
  service_port?: number
  service_type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'Headless'
  node_port?: number
  protocol?: 'TCP' | 'UDP'
  headless_service_enabled?: boolean
}

export type NetworkConfig = NetworkConfigV2 | LegacyNetworkConfig

// 服务基础接口
export interface BaseService {
  id?: string
  project_id: string
  name: string
  type: ServiceType
  status?: 'pending' | 'running' | 'stopped' | 'error' | 'building'
  created_at?: string
  updated_at?: string
  // 通用配置
  env_vars?: Record<string, string>
  resource_limits?: {
    cpu?: string
    memory?: string
  }
  // 卷挂载（通用）
  volumes?: Array<{
    nfs_subpath?: string     // NFS 子路径（相对于 PVC 根目录），默认为 {服务名}/{容器路径}
    container_path: string   // 容器路径（必填）
    read_only?: boolean
  }>
  // 网络配置（Kubernetes Service）
  network_config?: NetworkConfig
}

// Application 服务 - 基于源码构建
export interface ApplicationService extends BaseService {
  type: ServiceType.APPLICATION
  
  // Git 仓库配置
  git_provider?: GitProvider
  git_repository?: string      // 仓库 URL
  git_branch?: string          // 分支名
  git_path?: string           // 项目路径（monorepo）
  
  // 构建配置
  build_type?: BuildType
  dockerfile_path?: string     // Dockerfile 路径
  build_args?: Record<string, string>  // 构建参数
  
  // 部署配置
  port?: number               // 容器端口
  replicas?: number           // 副本数
  command?: string            // 启动命令
  
  // 自动部署
  auto_deploy?: boolean       // 是否自动部署
  
  // 构建后的镜像信息
  built_image?: string        // 构建后的镜像名称
}

// Database 服务 - 内置数据库镜像
export interface DatabaseService extends BaseService {
  type: ServiceType.DATABASE
  
  // 数据库配置
  database_type: DatabaseType
  version?: string            // 版本，如 8.0、6.2 等
  
  // 连接信息
  port?: number              // 内部端口
  external_port?: number     // 外部端口（如果需要外网访问）
  
  // 认证信息
  username?: string
  password?: string
  root_password?: string     // root 密码
  database_name?: string     // 初始数据库名
  
  // 持久化
  volume_size?: string       // 存储大小，如 10Gi
  
  // 内部连接信息（自动生成）
  internal_host?: string     // 内部主机名
  internal_connection_url?: string  // 内部连接 URL
}

// 镜像服务 - 基于现有镜像部署
export interface ImageService extends BaseService {
  type: ServiceType.IMAGE
  
  // 镜像配置
  image: string              // 镜像名称，如 nginx、redis
  tag?: string               // 镜像标签，如 latest、alpine
  
  // 部署配置
  command?: string           // 启动命令
  replicas?: number          // 副本数
  
  // 健康检查
  health_check?: {
    enabled: boolean
    path?: string
    interval?: number
  }
}

export type ServiceImageStatus = 'pending' | 'building' | 'success' | 'failed'

export interface ServiceImageRecord {
  id?: string
  service_id: string
  image: string
  tag: string
  full_image: string
  digest?: string
  build_number?: number
  build_status: ServiceImageStatus
  build_source?: string
  build_logs?: string
  metadata?: Record<string, unknown>
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

// 统一服务类型
export type Service = ApplicationService | DatabaseService | ImageService

// 服务创建请求类型
export type CreateServiceRequest = Omit<Service, 'id' | 'created_at' | 'updated_at' | 'status'>

// 服务更新请求类型
export type UpdateServiceRequest = Partial<CreateServiceRequest> & { id: string }

// 部署历史
export interface Deployment {
  id?: string
  service_id: string
  service_image_id?: string
  service_image?: ServiceImageRecord
  status: 'pending' | 'building' | 'success' | 'failed'
  build_logs?: string
  image_tag?: string
  created_at?: string
  completed_at?: string
}
