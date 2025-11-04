import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'

const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const normalizeIdentifier = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 63)

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json(projects)
  } catch (error: unknown) {
    console.error('[Project][GET] Failed to fetch projects:', error)
    const message = error instanceof Error ? error.message : '获取项目失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await request.json()

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const identifierInput = typeof payload.identifier === 'string' ? payload.identifier : ''
  const identifier = normalizeIdentifier(identifierInput)
  const description =
    typeof payload.description === 'string' && payload.description.trim() !== ''
      ? payload.description.trim()
      : null

  if (!name) {
    return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 })
  }

  if (!identifier || !IDENTIFIER_PATTERN.test(identifier)) {
    return NextResponse.json({ error: '项目编号格式不正确' }, { status: 400 })
  }

  const existing = await prisma.project.findUnique({
    where: { identifier }
  })

  if (existing) {
    return NextResponse.json({ error: '项目编号已被占用，请换一个' }, { status: 409 })
  }

  let project: Awaited<ReturnType<typeof prisma.project.create>> | null = null

  try {
    project = await prisma.project.create({
      data: {
        name,
        identifier,
        description
      }
    })
  } catch (error: unknown) {
    console.error('[Project][POST] Failed to create project:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: '项目编号已被占用，请换一个' }, { status: 409 })
    }

    const message = error instanceof Error ? error.message : '项目创建失败，请稍后重试'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 项目创建成功后，自动创建 K8s 命名空间和 NFS PVC
  let k8sWarning: string | undefined
  try {
    console.log(`[Project] 🚀 Starting K8s resources creation for project: ${identifier}`)
    await k8sService.createProjectPVC(identifier)
    console.log(`[Project] ✅ Successfully created namespace and PVC for project: ${identifier}`)
  } catch (k8sError: unknown) {
    const errorMsg = k8sError instanceof Error ? k8sError.message : String(k8sError)
    console.error(`[Project] ❌ Failed to create K8s resources for project ${identifier}:`, errorMsg)
    console.error('[Project] Error details:', k8sError)
    k8sWarning = `项目已创建，但 Kubernetes 资源创建失败：${errorMsg}`
    // 不阻断项目创建，但返回警告
  }

  if (!project) {
    return NextResponse.json({ error: '项目创建失败，请稍后重试' }, { status: 500 })
  }

  return NextResponse.json({
    ...project,
    ...(k8sWarning && { warning: k8sWarning })
  })
}
