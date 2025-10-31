import { ServiceType } from '@/types/project'

const SERVICE_TYPE_ALIASES: Record<string, ServiceType> = {
  application: ServiceType.APPLICATION,
  'application-service': ServiceType.APPLICATION,
  app: ServiceType.APPLICATION,
  应用: ServiceType.APPLICATION,
  应用服务: ServiceType.APPLICATION,
  source: ServiceType.APPLICATION,
  database: ServiceType.DATABASE,
  'database-service': ServiceType.DATABASE,
  db: ServiceType.DATABASE,
  数据库: ServiceType.DATABASE,
  数据库服务: ServiceType.DATABASE,
  image: ServiceType.IMAGE,
  'image-service': ServiceType.IMAGE,
  镜像: ServiceType.IMAGE,
  镜像服务: ServiceType.IMAGE,
  container: ServiceType.IMAGE,
  容器: ServiceType.IMAGE,
  容器服务: ServiceType.IMAGE
}

export const INVALID_SERVICE_TYPE_MESSAGE = '服务类型无效，请选择 Application、Database 或 Image。'

export const normalizeServiceType = (value: unknown): ServiceType | null => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const normalizedKey = normalized.replace(/[_\s]+/g, '-')

  return (
    SERVICE_TYPE_ALIASES[normalizedKey] ??
    SERVICE_TYPE_ALIASES[normalized]
  ) ?? null
}

export const isAllServiceTypeFilter = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false
  }

  return value.trim().toLowerCase() === 'all'
}
