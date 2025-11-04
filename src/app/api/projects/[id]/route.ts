import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const normalizeIdentifier = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 63)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error: unknown) {
    console.error('[Project][GET] Failed to fetch project:', error)
    const message = error instanceof Error ? error.message : '获取项目失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const duplicate = await prisma.project.findFirst({
    where: {
      identifier,
      NOT: { id }
    },
    select: { id: true }
  })

  if (duplicate) {
    return NextResponse.json({ error: '项目编号已被占用，请换一个' }, { status: 409 })
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        name,
        identifier,
        description
      }
    })

    return NextResponse.json(project)
  } catch (error: unknown) {
    console.error('[Project][PUT] Failed to update project:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 })
      }

      if (error.code === 'P2002') {
        return NextResponse.json({ error: '项目编号已被占用，请换一个' }, { status: 409 })
      }
    }

    const message = error instanceof Error ? error.message : '项目更新失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[Project][DELETE] Failed to delete project:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const message = error instanceof Error ? error.message : '删除项目失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
