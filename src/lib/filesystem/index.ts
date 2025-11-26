/**
 * 文件系统模块统一导出
 */

// 核心类型和错误
export {
  FileSystemError,
  FileSystemErrorCode,
  type FileEntry,
  type FileListResult,
  type FileUploadResult,
  type FileSystem,
  type PodInfo,
  type ExecResult,
  type CommandExecutor
} from './types'

// 工具函数
export {
  normalizePath,
  getParentPath,
  joinPath,
  validateFileName,
  escapeShellArg
} from './path-utils'

// 实现类
export { K8sPodExecutor } from './executor'
export { PodFileSystem } from './pod-filesystem'

// 向后兼容：别名导出 K8sFileError
export { FileSystemError as K8sFileError } from './types'
