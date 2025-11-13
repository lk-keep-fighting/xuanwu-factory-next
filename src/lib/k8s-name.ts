const DNS_LABEL_MAX_LENGTH = 63

const sanitizeLabel = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, DNS_LABEL_MAX_LENGTH)
}

export const sanitizeK8sResourceName = (value: string): string => {
  if (!value) {
    return ''
  }

  return sanitizeLabel(value.trim())
}

const ensureFallbackName = (fallback: string): string => {
  const normalized = sanitizeLabel(fallback)
  if (normalized) {
    return normalized
  }
  return 'svc'
}

export const buildServicePortName = (baseName: string, port: number): string => {
  const base = ensureFallbackName(baseName || 'svc')
  const suffix = `-${Math.abs(port)}`
  const maxBaseLength = Math.max(1, DNS_LABEL_MAX_LENGTH - suffix.length)
  let trimmedBase = base.slice(0, maxBaseLength)

  // 移除可能截断后产生的尾部连字符
  trimmedBase = trimmedBase.replace(/-+$/, '') || base.slice(0, maxBaseLength)
  trimmedBase = trimmedBase.replace(/-+$/, '') || 'svc'

  const combined = `${trimmedBase}${suffix}`
  const normalizedCombined = sanitizeLabel(combined)
  if (normalizedCombined) {
    return normalizedCombined
  }

  // 最后的兜底处理，确保返回合法字符串
  const fallback = `${base}${suffix}`.slice(0, DNS_LABEL_MAX_LENGTH)
  const normalizedFallback = sanitizeLabel(fallback)
  return normalizedFallback || 'svc'
}
