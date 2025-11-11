import { NextRequest, NextResponse } from 'next/server'
import { searchGitLabProjects } from '@/lib/gitlab'
import { requireGitProviderConfig } from '@/lib/system-config'

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')?.trim() ?? undefined
  const page = parseNumberParam(searchParams.get('page'))
  const perPage = parseNumberParam(searchParams.get('per_page'))

  try {
    const config = await requireGitProviderConfig()
    const result = await searchGitLabProjects(config, { search, page, perPage })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[SystemConfig][Repositories] Failed to search repositories:', error)
    const message = error instanceof Error ? error.message : '仓库搜索失败'

    if (message.includes('尚未配置') || message.includes('禁用')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    if (message.includes('Token') || message.includes('地址')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
