import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { k8sService, K8sFileError } from '@/lib/k8s'

const SERVICE_SELECT = {
  name: true,
  project: {
    select: { identifier: true }
  }
} as const

const createErrorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

const resolveServiceContext = async (id: string) => {
  const service = await prisma.service.findUnique({
    where: { id },
    select: SERVICE_SELECT
  })

  if (!service) {
    return { error: createErrorResponse('服务不存在', 404) }
  }

  const serviceName = service.name?.trim()
  if (!serviceName) {
    return { error: createErrorResponse('服务名称缺失，无法执行文件操作', 400) }
  }

  const namespace = service.project?.identifier?.trim()
  if (!namespace) {
    return { error: createErrorResponse('项目缺少编号，无法定位命名空间', 400) }
  }

  return { serviceName, namespace }
}

const encodeFileName = (fileName: string) => {
  const asciiName = fileName.replace(/[^\x20-\x7E]+/g, '') || fileName
  return {
    ascii: asciiName,
    encoded: encodeURIComponent(fileName)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await resolveServiceContext(id)
  if ('error' in context) {
    return context.error
  }

  const { searchParams } = new URL(request.url)
  const targetPath = searchParams.get('path')

  if (!targetPath || !targetPath.trim()) {
    return createErrorResponse('请提供要下载的文件路径', 400)
  }

  try {
    const fileBuffer = await k8sService.readContainerFile(
      context.serviceName,
      context.namespace,
      targetPath
    )
    const fileNameCandidate = targetPath.split('/').filter(Boolean).pop() || 'download.bin'
    const { ascii, encoded } = encodeFileName(fileNameCandidate)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
      }
    })
  } catch (error) {
    if (error instanceof K8sFileError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '下载文件失败'
    return createErrorResponse(message, 500)
  }
}
