import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatImageReference, parseImageReference } from '@/lib/service-image'

const LOG_STORAGE_LIMIT = 20000
const VALID_STATUSES = new Set(['building', 'success', 'failed'])

const truncateLog = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }

  if (value.length <= LOG_STORAGE_LIMIT) {
    return value
  }

  return value.slice(value.length - LOG_STORAGE_LIMIT)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const toJson = (value: Record<string, unknown>): Prisma.InputJsonObject => value as Prisma.InputJsonObject

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const toOptionalInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

const sanitizeMetadata = (value: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {}

  for (const [key, raw] of Object.entries(value)) {
    if (raw !== undefined) {
      sanitized[key] = raw
    }
  }

  return sanitized
}

type BuildCallbackPayload = {
  service_image_id?: unknown
  status?: unknown
  full_image?: unknown
  image?: unknown
  tag?: unknown
  digest?: unknown
  build_number?: unknown
  duration_ms?: unknown
  durationMs?: unknown
  duration_seconds?: unknown
  durationSeconds?: unknown
  build_url?: unknown
  queue_url?: unknown
  result?: unknown
  build_logs?: unknown
  metadata?: unknown
  error?: unknown
  error_message?: unknown
  build_source?: unknown
  source?: unknown
  secret?: unknown
  build_callback_secret?: unknown
  buildCallbackSecret?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体不是有效的 JSON 数据' }, { status: 400 })
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: '请求体格式不正确' }, { status: 400 })
  }

  const payload = rawBody as BuildCallbackPayload

  const expectedSecret = toOptionalString(process.env.BUILD_CALLBACK_SECRET)
  if (expectedSecret) {
    const headerSecret = toOptionalString(request.headers.get('x-build-callback-secret'))

    let providedSecret = headerSecret
    if (!providedSecret) {
      const authHeader = toOptionalString(request.headers.get('authorization'))
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        providedSecret = toOptionalString(authHeader.slice(7))
      }
    }

    if (!providedSecret) {
      providedSecret =
        toOptionalString(payload.secret) ??
        toOptionalString(payload.build_callback_secret) ??
        toOptionalString(payload.buildCallbackSecret)
    }

    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ error: '回调未授权' }, { status: 401 })
    }
  }

  const serviceImageId = toOptionalString(payload.service_image_id)
  if (!serviceImageId) {
    return NextResponse.json({ error: '缺少 service_image_id 字段' }, { status: 400 })
  }

  const rawStatus = toOptionalString(payload.status)?.toLowerCase()
  if (!rawStatus || !VALID_STATUSES.has(rawStatus)) {
    return NextResponse.json({ error: 'status 无效' }, { status: 400 })
  }

  try {
    const serviceImage = await prisma.serviceImage.findUnique({ where: { id: serviceImageId } })

    if (!serviceImage || serviceImage.service_id !== id) {
      return NextResponse.json({ error: '镜像记录不存在或不属于该服务' }, { status: 404 })
    }

    const providedFullImage = toOptionalString(payload.full_image)
    const providedImage = toOptionalString(payload.image)
    const providedTag = toOptionalString(payload.tag)

    const parsedFullImage = parseImageReference(providedFullImage ?? serviceImage.full_image)

    const normalizedImage = providedImage ?? parsedFullImage.image ?? serviceImage.image
    const normalizedTag = providedTag ?? parsedFullImage.tag ?? serviceImage.tag ?? undefined
    const normalizedFullImage = formatImageReference(normalizedImage, normalizedTag)

    const buildNumber = toOptionalInteger(payload.build_number)

    const durationMsCandidate = toOptionalNumber(payload.duration_ms ?? payload.durationMs)
    const durationSecondsCandidate = toOptionalNumber(
      payload.duration_seconds ?? payload.durationSeconds
    )
    const durationMs =
      durationMsCandidate ?? (durationSecondsCandidate !== undefined
        ? durationSecondsCandidate * 1000
        : undefined)

    const buildUrl = toOptionalString(payload.build_url)
    const queueUrl = toOptionalString(payload.queue_url)
    const digest = toOptionalString(payload.digest)

    let buildLogs: string | undefined
    if (typeof payload.build_logs === 'string') {
      buildLogs = truncateLog(payload.build_logs)
    }

    const providedResult = toOptionalString(payload.result)
    const effectiveResult = providedResult ?? (rawStatus === 'success' ? 'SUCCESS' : rawStatus.toUpperCase())

    const errorMessage = toOptionalString(payload.error) ?? toOptionalString(payload.error_message)

    const existingMetadata = isRecord(serviceImage.metadata)
      ? { ...serviceImage.metadata }
      : {}

    const extraMetadata = isRecord(payload.metadata) ? payload.metadata : undefined

    const mergedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      ...(extraMetadata ?? {})
    }

    if (buildUrl) {
      mergedMetadata.buildUrl = buildUrl
    }
    if (queueUrl) {
      mergedMetadata.queueUrl = queueUrl
    }
    if (durationMs !== undefined) {
      mergedMetadata.durationMs = durationMs
    }
    if (effectiveResult) {
      mergedMetadata.result = effectiveResult
    }
    if (buildNumber !== undefined) {
      mergedMetadata.buildNumber = buildNumber
    }
    if (normalizedFullImage) {
      mergedMetadata.fullImage = normalizedFullImage
    }
    if (digest) {
      mergedMetadata.digest = digest
    }
    if (errorMessage) {
      mergedMetadata.error = errorMessage
    }
    mergedMetadata.callbackUpdatedAt = new Date().toISOString()

    const sanitizedMetadata = sanitizeMetadata(mergedMetadata)

    const updateData: Prisma.ServiceImageUpdateInput = {
      build_status: rawStatus,
      metadata: toJson(sanitizedMetadata)
    }

    if (buildLogs !== undefined) {
      updateData.build_logs = buildLogs
    }
    if (buildNumber !== undefined) {
      updateData.build_number = buildNumber
    }
    if (digest) {
      updateData.digest = digest
    }
    if (normalizedImage) {
      updateData.image = normalizedImage
    }
    if (normalizedTag) {
      updateData.tag = normalizedTag
    }
    if (normalizedFullImage) {
      updateData.full_image = normalizedFullImage
    }

    const buildSource = toOptionalString(payload.build_source) ?? toOptionalString(payload.source)
    if (buildSource) {
      updateData.build_source = buildSource
    }

    if (rawStatus === 'success') {
      updateData.is_active = true
    } else if (rawStatus !== 'building') {
      updateData.is_active = false
    }

    const serviceUpdateData: Prisma.ServiceUpdateInput = {}

    if (rawStatus === 'success') {
      serviceUpdateData.status = 'pending'
      if (normalizedFullImage) {
        serviceUpdateData.built_image = normalizedFullImage
      }
    } else if (rawStatus === 'failed') {
      serviceUpdateData.status = 'error'
    }

    const tasks: Prisma.PrismaPromise<unknown>[] = []

    if (rawStatus === 'success') {
      tasks.push(
        prisma.serviceImage.updateMany({
          where: {
            service_id: id,
            id: { not: serviceImageId }
          },
          data: { is_active: false }
        })
      )
    }

    const imageUpdateIndex = tasks.length
    tasks.push(
      prisma.serviceImage.update({
        where: { id: serviceImageId },
        data: updateData
      })
    )

    let serviceUpdateIndex = -1
    if (Object.keys(serviceUpdateData).length > 0) {
      serviceUpdateIndex = tasks.length
      tasks.push(
        prisma.service.update({
          where: { id },
          data: serviceUpdateData
        })
      )
    }

    const results = await prisma.$transaction(tasks)
    const updatedImage = results[imageUpdateIndex] as Awaited<
      ReturnType<typeof prisma.serviceImage.update>
    >
    const updatedService =
      serviceUpdateIndex === -1
        ? await prisma.service.findUnique({ where: { id } })
        : (results[serviceUpdateIndex] as Awaited<ReturnType<typeof prisma.service.update>>)

    return NextResponse.json({
      success: true,
      status: rawStatus,
      image: updatedImage,
      service: updatedService,
      build: {
        status: rawStatus,
        result: effectiveResult,
        durationMs,
        buildNumber,
        buildUrl: buildUrl ?? undefined,
        queueUrl: queueUrl ?? undefined,
        fullImage: normalizedFullImage ?? undefined
      }
    })
  } catch (error) {
    console.error('[Services][BuildCallback] 处理构建回调失败:', error)

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2025'
    ) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const message = error instanceof Error ? error.message : '更新构建结果失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
