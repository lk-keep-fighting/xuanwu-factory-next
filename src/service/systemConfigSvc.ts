import type {
  GitProviderConfigResponse,
  GitRepositorySearchResult,
  UpdateGitProviderConfigPayload
} from '@/types/system'

const API_BASE = '/api/system/git-provider'

const parseErrorResponse = async (response: Response, fallback: string) => {
  try {
    const data = (await response.json()) as { error?: unknown }
    if (data && typeof data === 'object' && typeof data.error === 'string' && data.error.trim().length > 0) {
      return new Error(data.error.trim())
    }
  } catch {
    // ignore json parse error
  }

  const text = (await response.text().catch(() => '')).trim()
  if (text) {
    return new Error(text)
  }

  return new Error(fallback)
}

export const systemConfigSvc = {
  async getGitProviderConfig(): Promise<GitProviderConfigResponse> {
    const response = await fetch(API_BASE, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw await parseErrorResponse(response, '系统配置加载失败')
    }

    return (await response.json()) as GitProviderConfigResponse
  },

  async updateGitProviderConfig(payload: UpdateGitProviderConfigPayload): Promise<GitProviderConfigResponse> {
    const response = await fetch(API_BASE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw await parseErrorResponse(response, '系统配置保存失败')
    }

    return (await response.json()) as GitProviderConfigResponse
  },

  async searchGitRepositories(options: { search?: string; page?: number } = {}): Promise<GitRepositorySearchResult> {
    const params = new URLSearchParams()

    if (options.search) {
      params.set('search', options.search)
    }

    if (typeof options.page === 'number' && Number.isFinite(options.page) && options.page > 0) {
      params.set('page', String(options.page))
    }

    const response = await fetch(`${API_BASE}/repositories${params.size ? `?${params.toString()}` : ''}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw await parseErrorResponse(response, '仓库搜索失败')
    }

    return (await response.json()) as GitRepositorySearchResult
  }
}
