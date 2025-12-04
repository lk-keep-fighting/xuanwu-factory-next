import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { k8sService } from '@/lib/k8s'
import { prisma } from '@/lib/prisma'
import { DEFAULT_DOMAIN_ROOT, sanitizeDomainLabel } from '@/lib/network'
import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'

type ServiceWithProject = Prisma.ServiceGetPayload<{
  include: {
    project: {
      select: {
        identifier: true
      }
    }
  }
}>
import {
  ServicePayload,
  sanitizeServiceData,
  normalizePrismaError,
  normalizeUnknownError
} from '../helpers'
import { INVALID_SERVICE_TYPE_MESSAGE, normalizeServiceType } from '../service-type'

const UPDATE_ERROR_MESSAGE = '服务更新失败，请稍后重试。'
const DELETE_ERROR_MESSAGE = '删除服务失败'

const SERVICE_RESOURCE_KEYS = ['service', 'services', 'k8s_service', 'kubernetes_service'] as const
const INGRESS_RESOURCE_KEYS = ['ingress', 'ingresses', 'k8s_ingress', 'kubernetes_ingress'] as const

type JsonValue = Prisma.JsonValue

type DomainUpdateContext = {
  oldPrefix: string
  newPrefix: string
  domainSuffix: string | null
  normalizedSuffix: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const replaceExactStringValues = (
  candidate: unknown,
  oldValue: string,
  newValue: string
): boolean => {
  if (!isRecord(candidate)) {
    return false
  }

  let mutated = false
  for (const key of Object.keys(candidate)) {
    const raw = candidate[key]
    if (typeof raw === 'string' && raw.trim() === oldValue) {
      candidate[key] = newValue
      mutated = true
    }
  }
  return mutated
}

const updateIngressBackendServiceReferences = (
  specCandidate: unknown,
  oldName: string,
  newName: string
): boolean => {
  if (!isRecord(specCandidate)) {
    return false
  }
  const rules = specCandidate.rules
  if (!Array.isArray(rules)) {
    return false
  }

  let mutated = false
  for (const rule of rules) {
    if (!isRecord(rule)) continue
    const http = rule.http
    if (!isRecord(http)) continue
    const paths = http.paths
    if (!Array.isArray(paths)) continue

    for (const path of paths) {
      if (!isRecord(path)) continue
      const backend = path.backend
      if (!isRecord(backend)) continue
      const serviceRef = backend.service
      if (!isRecord(serviceRef)) continue
      const current = typeof serviceRef.name === 'string' ? serviceRef.name.trim() : ''
      if (current === oldName) {
        serviceRef.name = newName
        mutated = true
      }
    }
  }

  return mutated
}

const updateResourceDefinition = (
  resourceCandidate: unknown,
  type: 'service' | 'ingress',
  oldName: string,
  newName: string
): boolean => {
  const updateSingle = (resource: unknown): boolean => {
    if (!isRecord(resource)) {
      return false
    }

    let mutated = false
    const metadataCandidate = resource['metadata']
    if (isRecord(metadataCandidate)) {
      const rawName = typeof metadataCandidate['name'] === 'string' ? metadataCandidate['name'].trim() : ''
      if (rawName) {
        if (rawName === oldName) {
          metadataCandidate['name'] = newName
          mutated = true
        } else if (type === 'ingress' && rawName === `${oldName}-ingress`) {
          metadataCandidate['name'] = `${newName}-ingress`
          mutated = true
        }
      }

      if (
        isRecord(metadataCandidate['labels']) &&
        replaceExactStringValues(metadataCandidate['labels'], oldName, newName)
      ) {
        mutated = true
      }
    }

    const specCandidate = resource['spec']
    if (isRecord(specCandidate)) {
      if (type === 'service') {
        if (
          isRecord(specCandidate['selector']) &&
          replaceExactStringValues(specCandidate['selector'], oldName, newName)
        ) {
          mutated = true
        }
        const templateCandidate = specCandidate['template']
        if (
          isRecord(templateCandidate) &&
          isRecord(templateCandidate['metadata']) &&
          isRecord(templateCandidate['metadata']['labels']) &&
          replaceExactStringValues(templateCandidate['metadata']['labels'], oldName, newName)
        ) {
          mutated = true
        }
      } else if (type === 'ingress') {
        if (updateIngressBackendServiceReferences(specCandidate, oldName, newName)) {
          mutated = true
        }
      }
    }

    return mutated
  }

  if (Array.isArray(resourceCandidate)) {
    let mutated = false
    for (const item of resourceCandidate) {
      if (updateSingle(item)) {
        mutated = true
      }
    }
    return mutated
  }

  return updateSingle(resourceCandidate)
}

const updateDomainEntry = (domainCandidate: unknown, context: DomainUpdateContext): boolean => {
  if (!isRecord(domainCandidate)) {
    return false
  }

  if (!context.oldPrefix || !context.newPrefix) {
    return false
  }

  const domain = domainCandidate as Record<string, unknown>
  const rawPrefix = typeof domain['prefix'] === 'string' ? sanitizeDomainLabel(domain['prefix']) : ''
  const rawHost = typeof domain['host'] === 'string' ? (domain['host'] as string).trim() : ''
  const normalizedHost = rawHost.toLowerCase()
  const matchesPrefix = rawPrefix === context.oldPrefix
  const matchesHost =
    Boolean(context.normalizedSuffix) &&
    normalizedHost === `${context.oldPrefix}.${context.normalizedSuffix}`

  if (!matchesPrefix && !matchesHost) {
    return false
  }

  domain['prefix'] = context.newPrefix

  if (context.domainSuffix) {
    domain['host'] = `${context.newPrefix}.${context.domainSuffix}`
  } else if (normalizedHost.includes('.')) {
    const [, ...rest] = normalizedHost.split('.')
    domain['host'] = `${context.newPrefix}.${rest.join('.')}`
  } else {
    domain['host'] = context.newPrefix
  }

  return true
}

const updateNetworkConfigAssociations = (
  config: JsonValue | null,
  oldName: string,
  newName: string,
  projectIdentifier?: string | null
): { changed: boolean; value: JsonValue | null } => {
  if (!config || !isRecord(config)) {
    return { changed: false, value: config }
  }

  const cloned = cloneJson(config) as Record<string, unknown>
  const oldPrefix = sanitizeDomainLabel(oldName)
  const newPrefix = sanitizeDomainLabel(newName)
  const trimmedProject = projectIdentifier?.trim()
  const domainSuffix = trimmedProject ? `${trimmedProject}.${DEFAULT_DOMAIN_ROOT}` : null
  const normalizedSuffix = domainSuffix?.toLowerCase() ?? null
  let changed = false

  const domainContext: DomainUpdateContext = {
    oldPrefix,
    newPrefix,
    domainSuffix,
    normalizedSuffix
  }

  const portsCandidate = cloned['ports']
  if (Array.isArray(portsCandidate)) {
    for (const port of portsCandidate) {
      if (!isRecord(port)) continue
      if (updateDomainEntry(port['domain'], domainContext)) {
        changed = true
      }
    }
  } else if (updateDomainEntry(cloned['domain'], domainContext)) {
    changed = true
  }

  for (const key of SERVICE_RESOURCE_KEYS) {
    if (key in cloned) {
      if (updateResourceDefinition(cloned[key], 'service', oldName, newName)) {
        changed = true
      }
    }
  }

  for (const key of INGRESS_RESOURCE_KEYS) {
    if (key in cloned) {
      if (updateResourceDefinition(cloned[key], 'ingress', oldName, newName)) {
        changed = true
      }
    }
  }

  return { changed, value: changed ? (cloned as JsonValue) : config }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const service = await prisma.service.findUnique({ where: { id } })

    if (!service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    // Normalize debug_config for backward compatibility
    if (service.debug_config) {
      const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
      service.debug_config = normalizedDebugConfig as Prisma.JsonValue
    }

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][GET] 获取服务失败:', error)
    const message = error instanceof Error ? error.message : '获取服务失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch (error) {
    return NextResponse.json({ error: '请求体不是有效的 JSON 数据' }, { status: 400 })
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return NextResponse.json({ error: '请求体格式不正确' }, { status: 400 })
  }

  const body = rawBody as ServicePayload
  
  // Handle debug_config validation and normalization
  if (Object.prototype.hasOwnProperty.call(body, 'debug_config')) {
    const rawDebugConfig = body.debug_config
    
    // Normalize the config (handles legacy format conversion)
    const normalizedConfig = normalizeDebugConfig(rawDebugConfig)
    
    // Validate the normalized config
    const validation = validateDebugConfig(normalizedConfig)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: '调试工具配置验证失败', 
          details: validation.errors 
        },
        { status: 400 }
      )
    }
    
    // Replace the raw config with the normalized version
    // Cast to Prisma.JsonValue for type compatibility
    body.debug_config = normalizedConfig as Prisma.JsonValue | null
  }
  
  const updateData = sanitizeServiceData(body)
  let renameRequested = false
  let requestedName: string | null = null

  if (Object.prototype.hasOwnProperty.call(body, 'type')) {
    const normalizedType = normalizeServiceType(body.type)

    if (!normalizedType) {
      return NextResponse.json(
        { error: INVALID_SERVICE_TYPE_MESSAGE },
        { status: 400 }
      )
    }

    updateData.type = normalizedType
  }

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: '服务名称不能为空' }, { status: 400 })
    }

    updateData.name = body.name.trim()
    requestedName = updateData.name
    renameRequested = true
  }

  if (Object.prototype.hasOwnProperty.call(body, 'project_id')) {
    if (typeof body.project_id !== 'string' || !body.project_id.trim()) {
      return NextResponse.json({ error: '项目 ID 无效' }, { status: 400 })
    }

    updateData.project_id = body.project_id.trim()
  }

  if (renameRequested && requestedName) {
    const existingService = await prisma.service.findUnique({
      where: { id },
      select: {
        name: true,
        status: true,
        network_config: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!existingService) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const currentName = existingService.name?.trim() ?? ''

    if (currentName !== requestedName) {
      const normalizedStatus = (existingService.status ?? '').trim().toLowerCase()

      if (normalizedStatus !== 'pending') {
        return NextResponse.json({ error: '仅未部署的服务可以重命名。' }, { status: 400 })
      }

      const successfulDeployment = await prisma.deployment.findFirst({
        where: {
          service_id: id,
          status: 'success'
        },
        select: { id: true }
      })

      if (successfulDeployment) {
        return NextResponse.json({ error: '服务已有成功部署记录，无法重命名。' }, { status: 400 })
      }

      const networkUpdate = updateNetworkConfigAssociations(
        existingService.network_config as JsonValue | null,
        currentName,
        requestedName,
        existingService.project?.identifier ?? null
      )

      if (networkUpdate.changed) {
        updateData.network_config = networkUpdate.value ?? null
      }
    } else {
      delete updateData.name
    }
  }

  const dataEntries = Object.entries(updateData).filter(([, value]) => value !== undefined)

  if (dataEntries.length === 0) {
    return NextResponse.json({ error: '未提供可更新的字段' }, { status: 400 })
  }

  const data = Object.fromEntries(dataEntries) as Prisma.ServiceUncheckedUpdateInput
  
  // 移除 project_id，因为它是关系字段，不能在 update 操作中直接修改
  // 如果需要修改项目关联，应该使用单独的 API 端点
  delete (data as { project_id?: unknown }).project_id

  try {
    const service = await prisma.service.update({
      where: { id },
      data
    })

    return NextResponse.json(service)
  } catch (error: unknown) {
    console.error('[Services][PUT] 更新服务失败:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const normalized = normalizePrismaError(error, {
      defaultMessage: UPDATE_ERROR_MESSAGE
    })

    if (normalized) {
      return NextResponse.json({ error: normalized.message }, { status: normalized.status })
    }

    const { status, message } = normalizeUnknownError(error, UPDATE_ERROR_MESSAGE)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  const modeParam = (searchParams.get('mode') || '').trim().toLowerCase()
  const preserveParam = (searchParams.get('preserve_config') || '').trim().toLowerCase()
  const preserveConfig = ['true', '1', 'yes', 'y', 'on'].includes(preserveParam)
  const deleteMode: 'deployment-only' | 'full' =
    modeParam === 'deployment-only' || preserveConfig ? 'deployment-only' : 'full'

  let serviceWithProject: ServiceWithProject | null = null

  try {
    serviceWithProject = await prisma.service.findUnique({
      where: { id },
      include: {
        project: {
          select: { identifier: true }
        }
      }
    })
  } catch (error: unknown) {
    console.error('[Services][DELETE] 获取服务失败:', error)
    const message = error instanceof Error ? error.message : DELETE_ERROR_MESSAGE
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (!serviceWithProject) {
    return NextResponse.json({ error: '服务不存在' }, { status: 404 })
  }

  const { project: projectMeta } = serviceWithProject
  const namespace = projectMeta?.identifier?.trim()

  if (!namespace) {
    return NextResponse.json({ error: '项目缺少编号，无法删除服务' }, { status: 400 })
  }

  const serviceName = serviceWithProject.name?.trim()

  if (!serviceName) {
    return NextResponse.json({ error: '服务名称缺失，无法删除' }, { status: 400 })
  }

  let warning: string | undefined

  try {
    await k8sService.deleteService(serviceName, namespace)
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : String(error)

    const normalizedMessage = errorMessage.toLowerCase()
    const notFound =
      normalizedMessage.includes('not found') ||
      normalizedMessage.includes('404') ||
      normalizedMessage.includes('does not exist') ||
      normalizedMessage.includes('no matches') ||
      normalizedMessage.includes('不存在') ||
      normalizedMessage.includes('未找到')

    if (notFound) {
      warning = `Kubernetes 集群中未找到服务「${serviceName}」，已跳过集群资源清理。`

      if (errorMessage && errorMessage !== warning) {
        console.warn(`[Service Delete] Kubernetes 删除资源时未找到：${errorMessage}`)
      }
    } else {
      return NextResponse.json(
        { error: errorMessage || '删除 Kubernetes 资源失败' },
        { status: 500 }
      )
    }
  }

  if (deleteMode === 'deployment-only') {
    return NextResponse.json({
      success: true,
      message: '部署删除成功，服务配置已保留。',
      warning
    })
  }

  try {
    await prisma.service.delete({ where: { id } })
  } catch (error: unknown) {
    console.error('[Services][DELETE] 删除服务失败:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const message = error instanceof Error ? error.message : DELETE_ERROR_MESSAGE
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: '服务已删除', warning })
}
