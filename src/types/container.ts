/**
 * 容器部署相关的类型定义
 */

// 资源配额类型
export interface ResourceQuota {
  cpu: number; // CPU核心数 (0.1 - 8)
  memory: number; // 内存MB (128MB - 16GB) 
  storage: number; // 存储GB
}

// 成本估算
export interface CostEstimate {
  cpu: number;
  memory: number;
  storage: number;
  total: number;
  currency: string;
  period: string; // "day" | "month" | "year"
}

// 镜像配置
export interface ImageConfig {
  visibility: 'public' | 'private';
  imageName: string;
  tag?: string;
  registry?: string;
  credentials?: {
    username: string;
    password: string;
  };
}

// 部署信息
export interface DeploymentInfo {
  type: 'fixed' | 'scaling';
  replicas: number;
  minReplicas?: number;
  maxReplicas?: number;
  targetCpuUtilization?: number;
}

// 网络配置
export interface NetworkConfig {
  containerPort: number;
  enableInternetAccess: boolean;
  domain?: string;
  customDomain?: string;
  protocol: 'http' | 'https' | 'tcp' | 'udp';
  loadBalancer?: {
    enabled: boolean;
    type: 'internal' | 'external';
  };
}

// 环境变量
export interface EnvironmentVariable {
  key: string;
  value: string;
  type: 'plain' | 'secret' | 'configmap';
}

// 启动命令配置
export interface StartupCommand {
  command?: string[];
  args?: string[];
  workingDir?: string;
}

// 高级配置
export interface AdvancedConfig {
  environmentVariables: EnvironmentVariable[];
  startupCommand?: StartupCommand;
  volumes?: VolumeMount[];
  healthCheck?: HealthCheck;
  securityContext?: SecurityContext;
  nodeSelector?: Record<string, string>;
  tolerations?: Toleration[];
}

// 存储卷配置
export interface VolumeMount {
  name: string;
  mountPath: string;
  type: 'emptyDir' | 'configMap' | 'secret' | 'persistentVolume';
  size?: string;
  storageClass?: string;
}

// 健康检查
export interface HealthCheck {
  enabled: boolean;
  httpGet?: {
    path: string;
    port: number;
    scheme: 'HTTP' | 'HTTPS';
  };
  exec?: {
    command: string[];
  };
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
}

// 安全上下文
export interface SecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  fsGroup?: number;
  runAsNonRoot?: boolean;
  readOnlyRootFilesystem?: boolean;
  allowPrivilegeEscalation?: boolean;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
}

// 容忍度配置
export interface Toleration {
  key: string;
  operator: 'Equal' | 'Exists';
  value?: string;
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  tolerationSeconds?: number;
}

// 完整的容器应用配置
export interface ContainerAppConfig {
  // 基础信息
  name: string;
  description?: string;
  namespace?: string;
  labels?: Record<string, string>;
  
  // 镜像配置
  image: ImageConfig;
  
  // 资源配额
  resources: ResourceQuota;
  
  // 部署配置
  deployment: DeploymentInfo;
  
  // 网络配置
  network: NetworkConfig;
  
  // 高级配置
  advanced?: AdvancedConfig;
  
  // 元数据
  createdAt?: string;
  updatedAt?: string;
  status?: 'draft' | 'deploying' | 'running' | 'stopped' | 'failed';
}

// 容器应用创建请求
export interface CreateContainerAppRequest {
  appId?: number; // 关联的应用ID（可选，用于扩展现有应用）
  config: ContainerAppConfig;
}

// 容器应用更新请求
export interface UpdateContainerAppRequest {
  id: number;
  config: Partial<ContainerAppConfig>;
}

// 容器应用响应
export interface ContainerAppResponse extends ContainerAppConfig {
  id: number;
  appId?: number;
  kubernetesResources?: {
    deployment: string;
    service: string;
    ingress?: string;
    configMap?: string[];
    secret?: string[];
  };
}

// 部署状态
export interface DeploymentStatus {
  phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
  replicas: {
    desired: number;
    current: number;
    ready: number;
    available: number;
  };
  conditions: Array<{
    type: string;
    status: 'True' | 'False' | 'Unknown';
    reason?: string;
    message?: string;
    lastTransitionTime: string;
  }>;
  events: Array<{
    type: 'Normal' | 'Warning';
    reason: string;
    message: string;
    timestamp: string;
  }>;
}

// 资源使用情况
export interface ResourceUsage {
  cpu: {
    used: number;
    limit: number;
    percentage: number;
  };
  memory: {
    used: number;
    limit: number;
    percentage: number;
  };
  storage: {
    used: number;
    limit: number;
    percentage: number;
  };
}

// 应用类型扩展
export type AppDeploymentType = 'source' | 'container';

// 扩展现有App接口
export interface ExtendedApp {
  id: number;
  name: string;
  desc: string;
  gitUrl?: string;
  deploymentType: AppDeploymentType;
  containerConfig?: ContainerAppConfig;
  createdAt?: string;
  updatedAt?: string;
}
