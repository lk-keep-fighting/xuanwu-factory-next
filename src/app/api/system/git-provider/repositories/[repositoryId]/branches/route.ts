import { NextRequest, NextResponse } from 'next/server'
import { getGitLabProjectBranches } from '@/lib/gitlab'
import { requireGitProviderConfig } from '@/lib/system-config'

const parsePerPageParam = (value: string | null): number | undefined => {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export async function GET(
  request: NextRequest,
  context: { params: { repositoryId: string } }
) {
  const rawRepositoryId = context.params.repositoryId
  const repositoryId = (() => {
    try {
      return decodeURIComponent(rawRepositoryId)
    } catch {
      return rawRepositoryId
    }
  })().trim()

  if (!repositoryId) {
    return NextResponse.json({ error: '仓库标识不能为空' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')?.trim() || undefined
  const perPage = parsePerPageParam(searchParams.get('per_page'))

  try {
    const config = await requireGitProviderConfig()
    const result = await getGitLabProjectBranches(config, repositoryId, { search, perPage })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[SystemConfig][Branches] Failed to fetch repository branches:', error)
    const message = error instanceof Error ? error.message : '仓库分支加载失败'

    let status = 500
    if (/尚未配置|禁用/.test(message)) {
      status = 404
    } else if (/未找到仓库|无权访问|不存在/.test(message)) {
      status = 404
    } else if (/标识|Token|地址|无效/.test(message)) {
      status = 400
    }

    return NextResponse.json({ error: message }, { status })
  }
}
