import type { GitBranchInfo, GitBranchListResult, GitRepositoryInfo, GitRepositorySearchResult } from '@/types/system'
import { GitProvider } from '@/types/project'
import type { GitProviderConfigInternal } from './system-config'

const DEFAULT_PER_PAGE = 20
const DEFAULT_BRANCHES_PER_PAGE = 100

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

interface GitLabBranchCommit {
  id: string
  short_id: string
  title?: string | null
  message?: string | null
  author_name?: string | null
  committed_date?: string | null
}

interface GitLabBranch {
  name: string
  default: boolean
  merged: boolean
  protected: boolean
  web_url?: string | null
  commit?: GitLabBranchCommit | null
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

const tryParseUrl = (input: string): URL | null => {
  if (typeof input !== 'string') {
    return null
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const withProtocol = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(withProtocol)
  } catch {
    return null
  }
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

const normalizeGitLabBranch = (branch: GitLabBranch): GitBranchInfo => {
  const commit = branch.commit && typeof branch.commit.id === 'string'
    ? {
        id: branch.commit.id,
        shortId: branch.commit.short_id,
        title: branch.commit.title ?? null,
        message: branch.commit.message ?? null,
        authorName: branch.commit.author_name ?? null,
        committedDate: branch.commit.committed_date ?? null
      }
    : undefined

  return {
    name: branch.name,
    default: Boolean(branch.default),
    merged: Boolean(branch.merged),
    protected: Boolean(branch.protected),
    webUrl: branch.web_url ?? null,
    commit
  }
}

const encodeProjectIdentifier = (value: number | string): string => {
  if (typeof value === 'number') {
    return String(value)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('GitLab 项目标识不能为空')
  }

  let normalized = trimmed.replace(/^\/+/, '').replace(/\/+$/, '')

  try {
    normalized = decodeURIComponent(normalized)
  } catch {
    // ignore decode errors
  }

  normalized = normalized.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/{2,}/g, '/')

  if (/^\d+$/.test(normalized)) {
    return normalized
  }

  return encodeURIComponent(normalized)
}

export const extractGitLabProjectPath = (repositoryUrl: string, baseUrl?: string): string | null => {
  const repoUrl = tryParseUrl(repositoryUrl)
  if (!repoUrl) {
    return null
  }

  let pathname = repoUrl.pathname
  if (!pathname) {
    return null
  }

  pathname = pathname.replace(/\.git$/i, '')
  pathname = pathname.replace(/\/+$/, '')
  pathname = pathname.replace(/^\/+/, '')

  if (!pathname) {
    return null
  }

  if (!baseUrl) {
    return pathname
  }

  const base = tryParseUrl(baseUrl)
  if (!base) {
    return pathname
  }

  if (repoUrl.hostname !== base.hostname || repoUrl.port !== base.port) {
    return null
  }

  const baseSegments = base.pathname.split('/').filter(Boolean)
  let repoSegments = pathname.split('/').filter(Boolean)

  if (baseSegments.length > 0 && repoSegments.length >= baseSegments.length) {
    const matches = baseSegments.every((segment, index) => repoSegments[index] === segment)
    if (matches) {
      repoSegments = repoSegments.slice(baseSegments.length)
    }
  }

  const remaining = repoSegments.join('/')
  return remaining || null
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

export const getGitLabProjectBranches = async (
  config: GitProviderConfigInternal,
  project: number | string,
  options: {
    search?: string
    perPage?: number
  } = {}
): Promise<GitBranchListResult> => {
  if (config.provider !== GitProvider.GITLAB) {
    throw new Error('当前仅支持查询 GitLab 仓库分支')
  }

  if (!config.apiToken) {
    throw new Error('GitLab API Token 未配置')
  }

  const perPageRaw = typeof options.perPage === 'number' && options.perPage > 0 ? options.perPage : DEFAULT_BRANCHES_PER_PAGE
  const perPage = Math.min(perPageRaw, 100)

  let projectIdentifier: string
  try {
    projectIdentifier = encodeProjectIdentifier(project)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitLab 项目标识无效'
    throw new Error(message)
  }

  const url = buildGitLabApiUrl(config.baseUrl, `/api/v4/projects/${projectIdentifier}/repository/branches`, {
    per_page: perPage,
    search: options.search?.trim() || undefined
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
      throw new Error('未找到仓库或无权访问该仓库')
    }

    const errorText = (await response.text().catch(() => '')).trim()
    const message = errorText || `GitLab 分支列表请求失败 (${response.status})`
    throw new Error(message)
  }

  const rawBranches = (await response.json()) as GitLabBranch[]
  const items = rawBranches.map(normalizeGitLabBranch)
  const defaultBranch = items.find((branch) => branch.default)?.name ?? null

  return {
    items,
    defaultBranch
  }
}
