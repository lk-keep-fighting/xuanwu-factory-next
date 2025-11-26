/**
 * 路径处理工具
 * 
 * 纯函数实现，无副作用，易于测试
 */

import path from 'node:path'
import { FileSystemError, FileSystemErrorCode } from './types'

const POSIX_PATH = path.posix

/**
 * 规范化容器路径
 * 
 * @example
 * normalizePath('') => '/'
 * normalizePath('foo/bar') => '/foo/bar'
 * normalizePath('/foo/../bar') => '/bar'
 */
export function normalizePath(candidate?: string | null): string {
  if (!candidate?.trim()) {
    return '/'
  }

  const trimmed = candidate.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = POSIX_PATH.normalize(withLeadingSlash)

  if (!normalized || normalized === '.' || normalized === '') {
    return '/'
  }

  return normalized
}

/**
 * 获取父路径
 * 
 * @example
 * getParentPath('/foo/bar') => '/foo'
 * getParentPath('/foo') => '/'
 * getParentPath('/') => null
 */
export function getParentPath(pathValue: string): string | null {
  const normalized = normalizePath(pathValue)
  
  if (normalized === '/') {
    return null
  }

  const parent = POSIX_PATH.dirname(normalized)
  return parent === normalized ? '/' : parent
}

/**
 * 连接路径
 * 
 * @throws FileSystemError 如果 name 包含路径分隔符
 * 
 * @example
 * joinPath('/foo', 'bar') => '/foo/bar'
 * joinPath('/foo', '..') => '/'
 */
export function joinPath(basePath: string, name: string): string {
  const normalizedBase = normalizePath(basePath)
  const trimmedName = name.trim()

  if (!trimmedName || trimmedName === '.') {
    return normalizedBase
  }

  if (trimmedName === '..') {
    return getParentPath(normalizedBase) ?? '/'
  }

  if (trimmedName.includes('/')) {
    throw new FileSystemError(
      '路径中包含非法字符',
      FileSystemErrorCode.INVALID_NAME,
      400
    )
  }

  return POSIX_PATH.join(normalizedBase, trimmedName)
}

/**
 * 验证文件名
 * 
 * @throws FileSystemError 如果文件名非法
 */
export function validateFileName(fileName: string): string {
  const normalized = fileName?.trim()

  if (!normalized) {
    throw new FileSystemError(
      '文件名不能为空',
      FileSystemErrorCode.INVALID_NAME,
      400
    )
  }

  if (normalized === '.' || normalized === '..') {
    throw new FileSystemError(
      '文件名非法',
      FileSystemErrorCode.INVALID_NAME,
      400
    )
  }

  if (
    normalized.includes('/') ||
    normalized.includes('\0') ||
    normalized.includes('\n')
  ) {
    throw new FileSystemError(
      '文件名包含非法字符',
      FileSystemErrorCode.INVALID_NAME,
      400
    )
  }

  return normalized
}

/**
 * Shell 参数转义
 * 
 * 使用单引号包裹并转义内部单引号
 */
export function escapeShellArg(value: string): string {
  if (!value) {
    return "''"
  }

  return `'${value.replace(/'/g, "'\\''")}'`
}
