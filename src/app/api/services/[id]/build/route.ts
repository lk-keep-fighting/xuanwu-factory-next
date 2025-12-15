import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { JenkinsClient, JenkinsBuildError, JenkinsConfigError, type JenkinsBuildResult } from '@/lib/jenkins'
import { formatImageReference, limitTagLength, slugifyImageComponent } from '@/lib/service-image'
import { ServiceType, BuildType } from '@/types/project'

const DEFAULT_BRANCH = 'main'
const DEFAULT_BUILD_ERROR = '镜像构建失败，请稍后重试。'
const LOG_STORAGE_LIMIT = 20000

const truncateLog = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }

  if (value.length <= LOG_STORAGE_LIMIT) {
    return value
  }

  return value.slice(value.length - LOG_STORAGE_LIMIT)
}

const padNumber = (value: number): string => value.toString().padStart(2, '0')

const createImageTag = (branch: string, explicitTag?: string): string => {
  if (explicitTag?.trim()) {
    const normalized = slugifyImageComponent(explicitTag.trim(), 'build')
    return limitTagLength(normalized, 128)
  }

  const sanitizedBranch = slugifyImageComponent(branch || DEFAULT_BRANCH, 'build')
  const now = new Date()
  const timestamp = `${now.getFullYear()}${padNumber(now.getMonth() + 1)}${padNumber(now.getDate())}${padNumber(now.getHours())}${padNumber(now.getMinutes())}${padNumber(now.getSeconds())}`
  return limitTagLength(`${sanitizedBranch}-${timestamp}`, 128)
}

const splitAndSlugSegments = (value?: string | null): string[] => {
  if (!value) {
    return []
  }

  return value
    .split('/')
    .map((segment) => slugifyImageComponent(segment, 'scope'))
    .filter(Boolean)
}

const buildImageRepository = (serviceName: string, projectIdentifier?: string | null): string => {
  const registry = (process.env.APPLICATION_IMAGE_REGISTRY ?? process.env.APP_IMAGE_REGISTRY ?? '').trim().replace(/\/+$/u, '')
  const namespaceSegments = splitAndSlugSegments(process.env.APPLICATION_IMAGE_NAMESPACE ?? process.env.APP_IMAGE_NAMESPACE)
  const scopeSegments = splitAndSlugSegments(process.env.APPLICATION_IMAGE_SCOPE)

  const serviceSegment = slugifyImageComponent(serviceName, 'service')
  const projectSegment = projectIdentifier ? slugifyImageComponent(projectIdentifier, 'project') : null

  const repositorySegments: string[] = []
  if (registry) {
    repositorySegments.push(registry)
  }
  repositorySegments.push(...namespaceSegments)
  repositorySegments.push(...scopeSegments)
  if (projectSegment) {
    repositorySegments.push(projectSegment)
  }
  repositorySegments.push(serviceSegment)

  return repositorySegments.join('/')
}

type BuildRequestPayload = {
  branch?: string
  tag?: string
}

const toJson = (value: Record<string, unknown>): Prisma.InputJsonObject => value as Prisma.InputJsonObject

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let payload: BuildRequestPayload = {}
  try {
    const raw = await request.json()
    if (raw && typeof raw === 'object') {
      payload = raw as BuildRequestPayload
    }
  } catch {
    // ignore non-JSON payloads
  }

  let client: JenkinsClient
  try {
    client = JenkinsClient.fromEnvironment()
  } catch (error) {
    if (error instanceof JenkinsConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    console.error('[Services][Build] 初始化 Jenkins 客户端失败:', error)
    return NextResponse.json({ error: DEFAULT_BUILD_ERROR }, { status: 500 })
  }

  const serviceRecord = await prisma.service.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          identifier: true
        }
      }
    }
  })

  if (!serviceRecord) {
    return NextResponse.json({ error: '服务不存在' }, { status: 404 })
  }

  if ((serviceRecord.type ?? '').toLowerCase() !== ServiceType.APPLICATION) {
    return NextResponse.json({ error: '仅支持 Application 服务构建镜像' }, { status: 400 })
  }

  if (!serviceRecord.git_repository) {
    return NextResponse.json({ error: '服务未配置 Git 仓库信息，无法构建镜像。' }, { status: 400 })
  }

  const branchFromPayload = typeof payload.branch === 'string' ? payload.branch.trim() : ''
  const branch = branchFromPayload || serviceRecord.git_branch?.trim() || DEFAULT_BRANCH
  const requestedTag = typeof payload.tag === 'string' ? payload.tag.trim() : ''

  const repository = buildImageRepository(serviceRecord.name, serviceRecord.project?.identifier)
  const tag = createImageTag(branch, requestedTag)
  const fullImage = formatImageReference(repository, tag)

  let buildCallbackUrl: string | null = null
  try {
    const requestUrl = new URL(request.url)
    buildCallbackUrl = new URL(`/api/services/${id}/build/callback`, requestUrl.origin).toString()
  } catch (callbackError) {
    console.warn('[Services][Build] 无法生成构建回调地址:', callbackError)
  }

  const metadata: Record<string, unknown> = {
    branch,
    requestedTag: requestedTag || undefined
  }

  if (buildCallbackUrl) {
    metadata.buildCallbackUrl = buildCallbackUrl
  }

  try {
    await prisma.service.update({
      where: { id },
      data: { status: 'building' }
    })
  } catch (error) {
    console.error('[Services][Build] 更新服务状态失败:', error)
    return NextResponse.json({ error: DEFAULT_BUILD_ERROR }, { status: 500 })
  }

  const serviceImage = await prisma.serviceImage.create({
    data: {
      service_id: id,
      image: repository,
      tag,
      full_image: fullImage,
      build_status: 'building',
      metadata: toJson(metadata)
    }
  })

  metadata.serviceImageId = serviceImage.id

  const parameters: Record<string, string> = {
    SERVICE_ID: id,
    SERVICE_NAME: serviceRecord.name,
    PROJECT_ID: serviceRecord.project_id,
    PROJECT_IDENTIFIER: serviceRecord.project?.identifier ?? '',
    GIT_REPOSITORY: serviceRecord.git_repository,
    GIT_BRANCH: branch,
    IMAGE_REPOSITORY: repository,
    IMAGE_TAG: tag,
    FULL_IMAGE: fullImage,
    SERVICE_IMAGE_ID: serviceImage.id
  }

  // if (buildCallbackUrl) {
  //   parameters.BUILD_CALLBACK_URL = buildCallbackUrl
  // }

  // const callbackSecret = (process.env.BUILD_CALLBACK_SECRET ?? '').trim()
  // if (callbackSecret) {
  //   parameters.BUILD_CALLBACK_SECRET = callbackSecret
  // }

  // only pass GIT_PATH when it's a meaningful subpath (avoid passing '/' or empty defaults)
  if (serviceRecord.git_path) {
    const rawGitPath = String(serviceRecord.git_path).trim()
    if (rawGitPath && rawGitPath !== '/' && rawGitPath !== '.' && rawGitPath !== './') {
      parameters.GIT_PATH = rawGitPath
    }
  }
  if (serviceRecord.git_provider) {
    parameters.GIT_PROVIDER = serviceRecord.git_provider
  }
  if (serviceRecord.dockerfile_path) {
    parameters.DOCKERFILE_PATH = serviceRecord.dockerfile_path
  }
  if (serviceRecord.build_type) {
    parameters.BUILD_TYPE = serviceRecord.build_type
  }
  if (serviceRecord.build_args) {
    try {
      parameters.BUILD_ARGS = JSON.stringify(serviceRecord.build_args)
      
      // 为模板构建添加特定参数
      if (serviceRecord.build_type === BuildType.TEMPLATE) {
        const buildArgs = serviceRecord.build_args as Record<string, string>
        parameters.TEMPLATE_ID = buildArgs.template_id || ''
        parameters.CUSTOM_DOCKERFILE = buildArgs.custom_dockerfile || ''
      }
    } catch (error) {
      console.warn('[Services][Build] 序列化 build_args 失败:', error)
    }
  }

  let buildResult: JenkinsBuildResult | null = null

  try {
    // 根据构建类型选择不同的 Jenkins Job
    let jobName: string | undefined
    
    if (serviceRecord.build_type === BuildType.TEMPLATE) {
      // 使用专用的模板构建 Job
      jobName = 'CICD-STD/build-template'
    } else {
      // 使用默认的 Dockerfile 构建 Job
      jobName = undefined // 使用环境变量中配置的默认 Job
    }
    
    buildResult = await client.triggerBuild({
      jobName,
      parameters
    })
  } catch (error) {
    let errorMessage =
      error instanceof JenkinsBuildError
        ? error.message || DEFAULT_BUILD_ERROR
        : error instanceof Error
          ? error.message
          : DEFAULT_BUILD_ERROR

    // 为模板构建提供特定的错误提示
    if (serviceRecord.build_type === BuildType.TEMPLATE && 
        error instanceof JenkinsBuildError && 
        (error.message.includes('500') || error.message.includes('404'))) {
      errorMessage = `模板构建Job不存在：请在Jenkins中创建 CICD-STD/build-template Job，或联系管理员配置。当前已临时使用默认Job。`
    }

    const buildLogs = error instanceof JenkinsBuildError ? truncateLog(error.consoleText) : undefined

    const failedMetadata: Record<string, unknown> = {
      ...metadata,
      error: errorMessage,
      queueUrl: error instanceof JenkinsBuildError ? error.queueUrl : undefined,
      buildUrl: error instanceof JenkinsBuildError ? error.buildUrl : undefined
    }

    await prisma.$transaction([
      prisma.serviceImage.update({
        where: { id: serviceImage.id },
        data: {
          build_status: 'failed',
          build_logs: buildLogs,
          metadata: toJson(failedMetadata)
        }
      }),
      prisma.service.update({
        where: { id },
        data: { status: 'error' }
      })
    ])

    console.error('[Services][Build] Jenkins 构建失败:', error)
    return NextResponse.json({ error: errorMessage || DEFAULT_BUILD_ERROR }, { status: 500 })
  }

  const enrichedMetadata: Record<string, unknown> = {
    ...metadata,
    buildUrl: buildResult.buildUrl,
    queueUrl: buildResult.queueUrl,
    durationMs: buildResult.durationMs,
    result: buildResult.result
  }

  const buildLogs = truncateLog(buildResult.consoleText)

  if ((buildResult.result ?? '').toUpperCase() === 'SUCCESS') {
    await prisma.$transaction([
      prisma.serviceImage.updateMany({
        where: {
          service_id: id,
          id: { not: serviceImage.id }
        },
        data: { is_active: false }
      }),
      prisma.serviceImage.update({
        where: { id: serviceImage.id },
        data: {
          build_status: 'success',
          build_number: buildResult.buildNumber,
          build_logs: buildLogs,
          is_active: true,
          metadata: toJson(enrichedMetadata)
        }
      }),
      prisma.service.update({
        where: { id },
        data: {
          built_image: fullImage,
          status: 'pending'
        }
      })
    ])

    const [updatedImage, updatedService] = await Promise.all([
      prisma.serviceImage.findUnique({ where: { id: serviceImage.id } }),
      prisma.service.findUnique({ where: { id } })
    ])

    return NextResponse.json({
      success: true,
      image: updatedImage,
      service: updatedService,
      build: {
        buildNumber: buildResult.buildNumber,
        durationMs: buildResult.durationMs
      }
    })
  }

  await prisma.$transaction([
    prisma.serviceImage.update({
      where: { id: serviceImage.id },
      data: {
        build_status: 'failed',
        build_number: buildResult.buildNumber,
        build_logs: buildLogs,
        metadata: toJson(enrichedMetadata)
      }
    }),
    prisma.service.update({
      where: { id },
      data: { status: 'error' }
    })
  ])

  const failureMessage = `Jenkins 构建失败：${buildResult.result ?? '未知原因'}`
  return NextResponse.json({ error: failureMessage }, { status: 500 })
}
