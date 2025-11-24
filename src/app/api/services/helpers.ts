import { Prisma } from '@prisma/client'
import { sanitizeStartupConfig } from '@/lib/startup-config'

export const SERVICE_MUTABLE_FIELDS = [
  'project_id',
  'name',
  'type',
  'status',
  'env_vars',
  'resource_limits',
  'volumes',
  'network_config',
  'git_provider',
  'git_repository',
  'git_branch',
  'git_path',
  'build_type',
  'dockerfile_path',
  'build_args',
  'port',
  'replicas',
  'command',
  'k8s_startup_config',
  'auto_deploy',
  'built_image',
  'database_type',
  'version',
  'external_port',
  'username',
  'password',
  'root_password',
  'database_name',
  'volume_size',
  'internal_host',
  'internal_connection_url',
  'image',
  'tag',
  'health_check'
] as const

export type ServiceFieldKey = (typeof SERVICE_MUTABLE_FIELDS)[number]

export type ServicePayload = Record<string, unknown>

export type ServiceData = Partial<Prisma.ServiceUncheckedCreateInput>

export type NormalizedError = {
  status: number
  message: string
}

export const sanitizeServiceData = (payload: ServicePayload): ServiceData => {
  const data: Partial<Record<ServiceFieldKey, unknown>> = {}

  for (const key of SERVICE_MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const value = payload[key]
      if (value !== undefined) {
        data[key] = value
      }
    }
  }

  if (data.auto_deploy !== undefined) {
    data.auto_deploy = typeof data.auto_deploy === 'string'
      ? data.auto_deploy === 'true'
      : Boolean(data.auto_deploy)
  }

  if (Object.prototype.hasOwnProperty.call(data, 'k8s_startup_config')) {
    data.k8s_startup_config = sanitizeStartupConfig(data.k8s_startup_config ?? null)
  }

  return data as ServiceData
}

export const normalizePrismaError = (
  error: unknown,
  {
    defaultMessage,
    conflictMessage = '服务名称已存在，请更换其他名称。',
    foreignKeyMessage = '关联的项目不存在或已被删除。'
  }: {
    defaultMessage: string
    conflictMessage?: string
    foreignKeyMessage?: string
  }
): NormalizedError | null => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return {
        status: 409,
        message: conflictMessage
      }
    }

    if (error.code === 'P2003') {
      return {
        status: 400,
        message: foreignKeyMessage
      }
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      message: defaultMessage
    }
  }

  return null
}

export const normalizeUnknownError = (error: unknown, defaultMessage: string): NormalizedError => {
  if (error instanceof Error) {
    const raw = error.message.trim()
    const normalized = raw.toLowerCase()

    if (
      normalized.includes('fetch failed') ||
      normalized.includes('bad gateway') ||
      normalized.includes('unexpected end of json')
    ) {
      return {
        status: 502,
        message: '服务暂时不可用，请稍后重试。'
      }
    }

    if (raw) {
      return { status: 500, message: raw }
    }
  }

  return { status: 500, message: defaultMessage }
}
