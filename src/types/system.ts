import { GitProvider } from '@/types/project'

export interface GitLabProviderConfig {
  provider: GitProvider.GITLAB
  baseUrl: string
  enabled: boolean
  hasToken: boolean
}

export type GitProviderConfig = GitLabProviderConfig

export type GitProviderConfigResponse = GitProviderConfig | null

export interface UpdateGitProviderConfigPayload {
  provider: GitProvider.GITLAB
  baseUrl: string
  enabled: boolean
  apiToken?: string
  resetToken?: boolean
}

export interface GitRepositoryInfo {
  id: number
  name: string
  fullName: string
  pathWithNamespace: string
  httpUrlToRepo: string
  sshUrlToRepo?: string | null
  webUrl: string
  visibility: string
  description?: string | null
  lastActivityAt?: string | null
  defaultBranch?: string | null
}

export interface GitRepositorySearchResult {
  items: GitRepositoryInfo[]
  page: number
  totalPages?: number
  perPage?: number
}

export interface GitBranchInfo {
  name: string
  default: boolean
  merged: boolean
  protected: boolean
  webUrl?: string | null
  commit?: {
    id: string
    shortId: string
    title?: string | null
    message?: string | null
    authorName?: string | null
    committedDate?: string | null
  }
}

export interface GitBranchListResult {
  items: GitBranchInfo[]
  defaultBranch?: string | null
}
