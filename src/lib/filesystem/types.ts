/**
 * 文件系统核心类型定义
 * 
 * 设计原则：
 * 1. 数据结构优先 - 定义清晰的数据关系
 * 2. 零特殊情况 - 所有操作使用统一接口
 * 3. 简洁执念 - 最少的概念表达最多的能力
 */

/**
 * 文件/目录条目
 */
export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  isHidden: boolean
  size?: number
  modifiedAt?: Date
  permissions?: string
}

/**
 * 目录列表结果
 */
export interface FileListResult {
  path: string
  parentPath: string | null
  entries: FileEntry[]
}

/**
 * 文件上传结果
 */
export interface FileUploadResult {
  path: string
}

/**
 * 文件系统操作接口
 * 
 * 所有实现必须遵循以下约定：
 * - 路径格式：Unix风格绝对路径 (/)
 * - 错误处理：抛出 FileSystemError
 * - 幂等性：重复操作产生相同结果
 */
export interface FileSystem {
  /**
   * 列出目录内容
   * @throws FileSystemError 路径不存在或不是目录
   */
  list(path: string): Promise<FileListResult>

  /**
   * 读取文件内容
   * @throws FileSystemError 文件不存在或是目录
   */
  read(path: string): Promise<Buffer>

  /**
   * 写入文件
   * @param dirPath 目标目录路径
   * @param fileName 文件名（不含路径分隔符）
   * @param content 文件内容
   * @throws FileSystemError 目录不存在或权限不足
   */
  write(dirPath: string, fileName: string, content: Buffer): Promise<FileUploadResult>

  /**
   * 删除文件或目录
   * @throws FileSystemError 路径不存在或权限不足
   */
  delete(path: string): Promise<void>

  /**
   * 创建目录
   * @param recursive 是否递归创建父目录
   * @throws FileSystemError 父目录不存在且 recursive=false
   */
  mkdir(path: string, recursive?: boolean): Promise<void>
}

/**
 * Pod信息
 */
export interface PodInfo {
  namespace: string
  podName: string
  containerName: string
}

/**
 * 命令执行结果
 */
export interface ExecResult {
  stdout: Buffer
  stderr: Buffer
  exitCode: number | null
}

/**
 * 命令执行器接口
 */
export interface CommandExecutor {
  exec(command: string[], stdin?: Buffer): Promise<ExecResult>
}

/**
 * 文件系统错误
 */
export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly code: FileSystemErrorCode,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'FileSystemError'
  }
}

/**
 * 错误代码
 */
export enum FileSystemErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  NOT_DIRECTORY = 'NOT_DIRECTORY',
  IS_DIRECTORY = 'IS_DIRECTORY',
  INVALID_NAME = 'INVALID_NAME',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  EXEC_FAILED = 'EXEC_FAILED',
  POD_NOT_READY = 'POD_NOT_READY'
}
