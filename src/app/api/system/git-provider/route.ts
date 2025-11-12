import { NextRequest, NextResponse } from 'next/server'
import { GitProvider } from '@/types/project'
import {
  buildPublicGitProviderConfig,
  getGitProviderConfigInternal,
  saveGitProviderConfig
} from '@/lib/system-config'

const INVALID_PAYLOAD_MESSAGE = '请求参数无效'

const extractString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export async function GET() {
  try {
    const config = await getGitProviderConfigInternal()
    const payload = buildPublicGitProviderConfig(config)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('[SystemConfig][GET] Failed to load git provider config:', error)
    const message = error instanceof Error ? error.message : '系统配置读取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch (_error) {
    return NextResponse.json({ error: '请求体不是有效的 JSON 数据' }, { status: 400 })
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: INVALID_PAYLOAD_MESSAGE }, { status: 400 })
  }

  const body = rawBody as Record<string, unknown>
  const providerRaw = extractString(body.provider)
  const provider = providerRaw?.toLowerCase() ?? GitProvider.GITLAB

  if (provider !== GitProvider.GITLAB) {
    return NextResponse.json({ error: '当前仅支持配置 GitLab 作为 Git 提供商' }, { status: 400 })
  }

  const baseUrl = extractString(body.baseUrl) ?? extractString(body.base_url)
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true
  const apiToken = extractString(body.apiToken ?? body.api_token)
  const resetToken = Boolean(body.resetToken ?? body.reset_token ?? false)

  if (!baseUrl) {
    return NextResponse.json({ error: 'GitLab 基础地址不能为空' }, { status: 400 })
  }

  try {
    const existing = await getGitProviderConfigInternal()

    if (!existing?.apiToken && !apiToken && !resetToken) {
      return NextResponse.json({ error: '请提供有效的 GitLab API Token' }, { status: 400 })
    }

    const updated = await saveGitProviderConfig({
      provider: GitProvider.GITLAB,
      baseUrl,
      enabled,
      apiToken,
      resetToken
    })

    return NextResponse.json(buildPublicGitProviderConfig(updated))
  } catch (error) {
    console.error('[SystemConfig][PUT] Failed to update git provider config:', error)
    const message = error instanceof Error ? error.message : '配置保存失败'
    const status = message.includes('地址') || message.includes('Token') ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
