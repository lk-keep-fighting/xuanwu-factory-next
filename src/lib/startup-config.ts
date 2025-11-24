import type { K8sStartupConfig } from '@/types/project'

export const parseStartupMultilineInput = (value?: string | null): string[] => {
  if (!value) {
    return []
  }

  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export const formatStartupMultilineValue = (values?: string[] | null): string => {
  if (!values || values.length === 0) {
    return ''
  }

  return values.join('\n')
}

const normalizeList = (value?: unknown): string[] => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim()
        }
        if (entry === null || entry === undefined) {
          return ''
        }
        return String(entry).trim()
      })
      .filter((entry) => entry.length > 0)
  }

  if (typeof value === 'string') {
    return parseStartupMultilineInput(value)
  }

  return []
}

export const sanitizeStartupConfig = (input: unknown): K8sStartupConfig | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  const candidate = input as Partial<K8sStartupConfig>
  const sanitized: K8sStartupConfig = {}

  if (typeof candidate.working_dir === 'string') {
    const workingDir = candidate.working_dir.trim()
    if (workingDir) {
      sanitized.working_dir = workingDir
    }
  }

  const command = normalizeList(candidate.command)
  if (command.length) {
    sanitized.command = command
  }

  const args = normalizeList(candidate.args)
  if (args.length) {
    sanitized.args = args
  }

  return Object.keys(sanitized).length ? sanitized : null
}

export const buildStartupCommandPreview = (config?: K8sStartupConfig | null): string | null => {
  if (!config) {
    return null
  }

  const commandParts: string[] = []

  if (Array.isArray(config.command)) {
    commandParts.push(...config.command.filter((part) => typeof part === 'string' && part.trim().length > 0))
  }

  if (Array.isArray(config.args)) {
    commandParts.push(...config.args.filter((part) => typeof part === 'string' && part.trim().length > 0))
  }

  if (!commandParts.length) {
    return null
  }

  return commandParts.join(' ')
}

export const hasStartupConfiguration = (config?: K8sStartupConfig | null): boolean => {
  if (!config) {
    return false
  }

  if (typeof config.working_dir === 'string' && config.working_dir.trim().length > 0) {
    return true
  }

  if (Array.isArray(config.command) && config.command.length > 0) {
    return true
  }

  if (Array.isArray(config.args) && config.args.length > 0) {
    return true
  }

  return false
}
