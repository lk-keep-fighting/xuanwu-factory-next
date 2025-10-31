import type { Service } from '@/types/project'
import type { K8sImportCandidate, K8sWorkloadKind } from '@/types/k8s'

const API_BASE = '/api/k8s/services'

export const k8sSvc = {
  async listImportableServices(namespace?: string): Promise<K8sImportCandidate[]> {
    const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : ''
    const response = await fetch(`${API_BASE}${params}`)

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
    const response = await fetch(`${API_BASE}/import`, {
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
