import type { Prisma } from '@prisma/client'
import { GitProvider } from '@/types/project'
import { prisma } from './prisma'

const GIT_PROVIDER_CONFIG_KEY = 'git_provider.global'

type StoredGitProviderValue = Prisma.JsonObject & {
  provider?: unknown
  enabled?: unknown
  baseUrl?: unknown
  apiToken?: unknown
}

export type GitProviderConfigInternal = {
  provider: GitProvider
  enabled: boolean
  baseUrl: string
  apiToken?: string
}

const isJsonObject = (value: Prisma.JsonValue | null): value is Prisma.JsonObject => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

const normalizeUrl = (input: string): string => {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('GitLab 基础地址不能为空')
  }

  const withProtocol = /^(https?:)?\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL

  try {
    url = new URL(withProtocol)
  } catch (_error) {
    throw new Error('GitLab 基础地址无效，请检查后重试')
  }

  // Remove trailing slash but keep path if provided
  const withoutTrailingSlash = `${url.origin}${url.pathname}`.replace(/\/$/, '')
  const normalized = withoutTrailingSlash || url.origin

  return normalized
}

const toInternalConfig = (value: Prisma.JsonValue | null): GitProviderConfigInternal | null => {
  if (!isJsonObject(value)) {
    return null
  }

  const data = value as StoredGitProviderValue
  const provider = data.provider === GitProvider.GITLAB ? GitProvider.GITLAB : null
  if (!provider) {
    return null
  }

  const baseUrl = typeof data.baseUrl === 'string' && data.baseUrl.trim().length > 0 ? data.baseUrl.trim() : null
  if (!baseUrl) {
    return null
  }

  const enabled = typeof data.enabled === 'boolean' ? data.enabled : true
  const apiToken = typeof data.apiToken === 'string' && data.apiToken.trim().length > 0 ? data.apiToken.trim() : undefined

  return {
    provider,
    enabled,
    baseUrl,
    apiToken
  }
}

export const getGitProviderConfigInternal = async (): Promise<GitProviderConfigInternal | null> => {
  const record = await prisma.systemConfig.findUnique({
    where: { key: GIT_PROVIDER_CONFIG_KEY }
  })

  if (!record) {
    return null
  }

  return toInternalConfig(record.value)
}

type SaveGitProviderOptions = {
  provider: GitProvider
  baseUrl: string
  enabled?: boolean
  apiToken?: string | null
  resetToken?: boolean
}

export const saveGitProviderConfig = async ({
  provider,
  baseUrl,
  enabled = true,
  apiToken,
  resetToken = false
}: SaveGitProviderOptions): Promise<GitProviderConfigInternal> => {
  if (provider !== GitProvider.GITLAB) {
    throw new Error('当前仅支持 GitLab 作为 Git 提供商')
  }

  const normalizedBaseUrl = normalizeUrl(baseUrl)
  const existing = await getGitProviderConfigInternal()

  let resolvedToken: string | undefined

  if (resetToken) {
    resolvedToken = undefined
  } else if (typeof apiToken === 'string') {
    const trimmed = apiToken.trim()
    resolvedToken = trimmed.length > 0 ? trimmed : undefined
  } else {
    resolvedToken = existing?.apiToken
  }

  const value: Prisma.JsonObject = {
    provider,
    enabled,
    baseUrl: normalizedBaseUrl
  }

  if (resolvedToken) {
    value.apiToken = resolvedToken
  }

  await prisma.systemConfig.upsert({
    where: { key: GIT_PROVIDER_CONFIG_KEY },
    update: { value },
    create: {
      key: GIT_PROVIDER_CONFIG_KEY,
      value
    }
  })

  return {
    provider,
    enabled,
    baseUrl: normalizedBaseUrl,
    apiToken: resolvedToken
  }
}

export const requireGitProviderConfig = async (): Promise<GitProviderConfigInternal> => {
  const config = await getGitProviderConfigInternal()
  if (!config) {
    throw new Error('Git 提供商尚未配置')
  }

  if (!config.enabled) {
    throw new Error('Git 提供商已被禁用')
  }

  if (!config.apiToken) {
    throw new Error('Git 提供商缺少 API Token 配置')
  }

  return config
}

export const buildPublicGitProviderConfig = (
  internal: GitProviderConfigInternal | null
) => {
  if (!internal) {
    return null
  }

  return {
    provider: internal.provider,
    enabled: internal.enabled,
    baseUrl: internal.baseUrl,
    hasToken: Boolean(internal.apiToken)
  }
}
