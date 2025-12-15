import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractGitLabProjectPath } from '@/lib/gitlab'
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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // 获取服务信息
  const service = await prisma.service.findUnique({
    where: { id },
    select: {
      git_repository: true,
      git_provider: true
    }
  })

  if (!service) {
    return NextResponse.json({ error: '服务不存在' }, { status: 404 })
  }

  if (!service.git_repository) {
    return NextResponse.json({ error: '服务未配置Git仓库' }, { status: 400 })
  }

  // 提取仓库路径
  let repositoryPath: string
  try {
    repositoryPath = extractGitLabProjectPath(service.git_repository)
  } catch (error) {
    console.error('[Services][Branches] Failed to extract repository path:', error)
    return NextResponse.json({ error: '无效的Git仓库地址' }, { status: 400 })
  }

  // 获取查询参数
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')?.trim() || undefined
  const perPage = parsePerPageParam(searchParams.get('per_page'))

  try {
    // 获取Git提供商配置
    const config = await requireGitProviderConfig()
    
    // 获取分支列表
    const result = await getGitLabProjectBranches(config, repositoryPath, { search, perPage })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Services][Branches] Failed to fetch branches:', error)
    const message = error instanceof Error ? error.message : '获取分支列表失败'

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