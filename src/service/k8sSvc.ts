import type { Service } from '@/types/project'
import type { K8sImportCandidate, K8sWorkloadKind } from '@/types/k8s'

const SERVICES_API_BASE = '/api/k8s/services'
const NAMESPACES_API = '/api/k8s/namespaces'

export const k8sSvc = {
  async listNamespaces(): Promise<string[]> {
    const response = await fetch(NAMESPACES_API)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || '无法获取命名空间列表')
    }

    const data = await response.json()
    if (!Array.isArray(data)) {
      return []
    }

    return data
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length)
  },

  async listImportableServices(namespace?: string): Promise<K8sImportCandidate[]> {
    const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    const response = await fetch(`${SERVICES_API_BASE}${params}`)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || '无法获取 Kubernetes 服务列表')
    }

    return response.json()
  },

  async importService(
    projectId: string,
    resource: { namespace: string; name: string; kind: K8sWorkloadKind }
  ): Promise<Service> {
    const response = await fetch(`${SERVICES_API_BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, resource })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error((error as { error?: string }).error || '导入 Kubernetes 服务失败')
    }

    return response.json()
  }
}
