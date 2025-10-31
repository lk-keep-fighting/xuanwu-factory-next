export const DEFAULT_DOMAIN_ROOT = 'dev.aimstek.cn'

export const sanitizeDomainLabel = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 63)
