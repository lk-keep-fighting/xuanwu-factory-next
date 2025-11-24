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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await resolveServiceContext(id)
  if ('error' in context) {
    return context.error
  }

  const { searchParams } = new URL(request.url)
  const targetPath = searchParams.get('path') ?? '/'

  try {
    const payload = await k8sService.listContainerFiles(context.serviceName, context.namespace, targetPath)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof K8sFileError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '获取文件列表失败'
    return createErrorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await resolveServiceContext(id)
  if ('error' in context) {
    return context.error
  }

  const formData = await request.formData()
  const pathField = formData.get('path')
  const targetPath = typeof pathField === 'string' && pathField.trim() ? pathField : '/'
  const fileField = formData.get('file')

  if (!fileField || typeof (fileField as Blob).arrayBuffer !== 'function') {
    return createErrorResponse('未检测到上传文件', 400)
  }

  const uploadBlob = fileField as Blob & { name?: string }
  const inferredName = typeof uploadBlob.name === 'string' ? uploadBlob.name : ''
  const fallbackNameField = formData.get('filename')
  const fallbackName = typeof fallbackNameField === 'string' ? fallbackNameField : ''
  const fileName = inferredName?.trim() || fallbackName.trim()

  const arrayBuffer = await uploadBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const result = await k8sService.uploadContainerFile(
      context.serviceName,
      context.namespace,
      targetPath,
      fileName,
      buffer
    )

    return NextResponse.json({ success: true, path: result.path })
  } catch (error) {
    if (error instanceof K8sFileError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '上传文件失败'
    return createErrorResponse(message, 500)
  }
}
