import type { GitRepositoryInfo, GitRepositorySearchResult } from '@/types/system'
import { GitProvider } from '@/types/project'
import type { GitProviderConfigInternal } from './system-config'

const DEFAULT_PER_PAGE = 20

interface GitLabProject {
  id: number
  name: string
  name_with_namespace?: string
  path_with_namespace: string
  http_url_to_repo: string
  ssh_url_to_repo?: string | null
  web_url: string
  description?: string | null
  visibility: string
  last_activity_at?: string | null
  default_branch?: string | null
}

const buildGitLabApiUrl = (
  baseUrl: string,
  path: string,
  params: Record<string, string | number | boolean | null | undefined>
) => {
  const trimmedBase = baseUrl.replace(/\/+$/, '') + '/'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(normalizedPath, trimmedBase)

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const stringValue = String(value)
    if (stringValue.length === 0) continue
    url.searchParams.set(key, stringValue)
  }

  return url.toString()
}

const normalizeGitLabProject = (project: GitLabProject): GitRepositoryInfo => {
  return {
    id: project.id,
    name: project.name,
    fullName: project.name_with_namespace ?? project.path_with_namespace,
    pathWithNamespace: project.path_with_namespace,
    httpUrlToRepo: project.http_url_to_repo,
    sshUrlToRepo: project.ssh_url_to_repo ?? null,
    webUrl: project.web_url,
    visibility: project.visibility,
    description: project.description ?? null,
    lastActivityAt: project.last_activity_at ?? null,
    defaultBranch: project.default_branch ?? null
  }
}

export const searchGitLabProjects = async (
  config: GitProviderConfigInternal,
  options: {
    search?: string
    page?: number
    perPage?: number
  } = {}
): Promise<GitRepositorySearchResult> => {
  if (config.provider !== GitProvider.GITLAB) {
    throw new Error('当前仅支持查询 GitLab 仓库')
  }

  if (!config.apiToken) {
    throw new Error('GitLab API Token 未配置')
  }

  const page = typeof options.page === 'number' && options.page > 0 ? options.page : 1
  const perPage = typeof options.perPage === 'number' && options.perPage > 0
    ? Math.min(options.perPage, 100)
    : DEFAULT_PER_PAGE

  const url = buildGitLabApiUrl(config.baseUrl, '/api/v4/projects', {
    membership: true,
    simple: true,
    search: options.search?.trim() || undefined,
    order_by: 'last_activity_at',
    sort: 'desc',
    per_page: perPage,
    page
  })

  const response = await fetch(url, {
    headers: {
      'PRIVATE-TOKEN': config.apiToken,
      Accept: 'application/json'
    },
    cache: 'no-store'
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('GitLab API Token 无效或权限不足')
    }

    if (response.status === 404) {
      throw new Error('GitLab 接口不可用，请检查基础地址配置')
    }

    const errorText = (await response.text().catch(() => '')).trim()
    const message = errorText || `GitLab 接口请求失败 (${response.status})`
    throw new Error(message)
  }

  const rawData = (await response.json()) as GitLabProject[]
  const totalPages = Number(response.headers.get('x-total-pages') ?? '0')

  return {
    items: rawData.map(normalizeGitLabProject),
    page,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : undefined,
    perPage
  }
}
