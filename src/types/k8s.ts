import type { NetworkConfig, BaseService } from './project'

export type K8sWorkloadKind = 'Deployment' | 'StatefulSet'

export interface K8sImportServicePort {
  name?: string
  port: number
  targetPort: number
  protocol: 'TCP' | 'UDP'
  nodePort?: number
}

export interface K8sImportMatchedService {
  name: string
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
  ports: K8sImportServicePort[]
}

export interface K8sImportContainerInfo {
  name: string
  image: string
  tag?: string
  command?: string
  env?: Record<string, string>
}

export interface K8sImportVolumeInfo {
  containerPath: string
  hostPath?: string
  readOnly?: boolean
  subPath?: string
}

export interface K8sImportCandidate {
  uid: string
  name: string
  namespace: string
  kind: K8sWorkloadKind
  labels: Record<string, string>
  replicas: number
  image: string
  tag?: string
  command?: string
  containers: K8sImportContainerInfo[]
  volumes: K8sImportVolumeInfo[]
  services: K8sImportMatchedService[]
  networkConfig?: NetworkConfig
}

export interface K8sImportRequest {
  project_id: string
  resource: {
    namespace: string
    name: string
    kind: K8sWorkloadKind
  }
}

export interface K8sServiceStatus {
  status: 'running' | 'pending' | 'stopped' | 'error'
  replicas?: number
  availableReplicas?: number
  readyReplicas?: number
  updatedReplicas?: number
  conditions?: Array<Record<string, unknown>>
  namespace?: string
  serviceName?: string
  dbStatus?: BaseService['status']
  error?: string
  podStatus?: {
    imagePullFailed?: boolean
    imagePullError?: string
    containerStatuses?: Array<Record<string, unknown>>
  } | null
}

export type K8sFileEntryType = 'file' | 'directory' | 'other'

export interface K8sFileEntry {
  name: string
  path: string
  type: K8sFileEntryType
  isHidden: boolean
}

export interface K8sFileListResult {
  path: string
  parentPath: string | null
  entries: K8sFileEntry[]
}
