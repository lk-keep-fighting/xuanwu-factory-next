/**
 * Pod 文件系统实现
 * 
 * 通过 shell 命令操作容器内文件系统
 * 所有操作使用统一的错误处理和退出码映射
 */

import type {
  FileSystem,
  FileListResult,
  FileUploadResult,
  FileEntry,
  CommandExecutor
} from './types'
import { FileSystemError, FileSystemErrorCode } from './types'
import {
  normalizePath,
  getParentPath,
  joinPath,
  validateFileName,
  escapeShellArg
} from './path-utils'

/**
 * 文件操作退出码
 */
const EXIT_CODE = {
  NOT_FOUND: 44,
  NOT_DIRECTORY: 45,
  IS_DIRECTORY: 46
} as const

/**
 * 退出码到错误的映射
 * 
 * 消除 if/else 特殊情况，用数据结构表达
 */
const EXIT_CODE_ERROR_MAP: Record<
  number,
  { code: FileSystemErrorCode; message: string; statusCode: number }
> = {
  [EXIT_CODE.NOT_FOUND]: {
    code: FileSystemErrorCode.NOT_FOUND,
    message: '路径不存在',
    statusCode: 404
  },
  [EXIT_CODE.NOT_DIRECTORY]: {
    code: FileSystemErrorCode.NOT_DIRECTORY,
    message: '路径不是目录',
    statusCode: 400
  },
  [EXIT_CODE.IS_DIRECTORY]: {
    code: FileSystemErrorCode.IS_DIRECTORY,
    message: '无法操作目录',
    statusCode: 400
  }
}

/**
 * Pod 文件系统实现
 */
export class PodFileSystem implements FileSystem {
  constructor(private readonly executor: CommandExecutor) {}

  async list(path: string): Promise<FileListResult> {
    const normalizedPath = normalizePath(path)
    
    // 使用最兼容的方法获取文件信息（包括大小）
    // 避免使用 -printf，因为BusyBox find不支持
    const script = `
TARGET=${escapeShellArg(normalizedPath)}
if [ ! -e "$TARGET" ]; then exit 44; fi
if [ ! -d "$TARGET" ]; then exit 45; fi
cd "$TARGET" || exit 1

# 使用 ls 配合循环，更可靠
for file in * .[!.]* ..?*; do
  # 跳过不存在的文件（glob 没匹配到）
  [ -e "$file" ] || continue
  # 跳过 . 和 ..
  [ "$file" = "." ] && continue
  [ "$file" = ".." ] && continue
  
  if [ -d "$file" ]; then
    echo "d	0	$file"
  else
    # 尝试获取文件大小
    if [ -f "$file" ]; then
      size=$(wc -c < "$file" 2>/dev/null || echo 0)
      echo "f	$size	$file"
    fi
  fi
done
`.trim()

    const result = await this.executor.exec(['sh', '-c', script])
    this.checkExitCode(result.exitCode, result.stderr)

    const rawOutput = result.stdout.toString('utf8')
    console.log(`[PodFS] 原始输出长度: ${rawOutput.length}B, 内容预览: ${rawOutput.substring(0, 200)}`)
    
    const entries = this.parseDirectoryListingWithSize(
      rawOutput,
      normalizedPath
    )

    return {
      path: normalizedPath,
      parentPath: getParentPath(normalizedPath),
      entries
    }
  }

  async read(path: string): Promise<Buffer> {
    const normalizedPath = normalizePath(path)
    
    const script = this.buildScript([
      `TARGET=${escapeShellArg(normalizedPath)}`,
      'if [ ! -e "$TARGET" ]; then exit 44; fi',
      'if [ -d "$TARGET" ]; then exit 46; fi',
      'cat "$TARGET"'
    ])

    const result = await this.executor.exec(['sh', '-c', script])
    this.checkExitCode(result.exitCode, result.stderr)

    return result.stdout
  }

  async write(
    dirPath: string,
    fileName: string,
    content: Buffer
  ): Promise<FileUploadResult> {
    const normalizedDir = normalizePath(dirPath)
    const sanitizedFileName = validateFileName(fileName)
    const targetFilePath = joinPath(normalizedDir, sanitizedFileName)
    const fileSizeKB = (content.length / 1024).toFixed(2)

    console.log(`[PodFS] 开始写入文件: ${targetFilePath}, 大小: ${fileSizeKB}KB`)

    // 检查文件大小限制（10MB）
    const maxSizeBytes = 10 * 1024 * 1024
    if (content.length > maxSizeBytes) {
      throw new FileSystemError(
        `文件过大（${fileSizeKB}KB），最大支持10MB`,
        FileSystemErrorCode.EXEC_FAILED,
        400
      )
    }

    // 警告：大文件上传可能很慢
    if (content.length > 100 * 1024) {
      console.warn(`[PodFS] 警告: 文件较大（${fileSizeKB}KB），上传可能需要较长时间`)
    }

    const script = this.buildScript([
      `TARGET_DIR=${escapeShellArg(normalizedDir)}`,
      'if [ ! -d "$TARGET_DIR" ]; then exit 45; fi',
      `cat > ${escapeShellArg(targetFilePath)}`
    ])

    const startTime = Date.now()
    const result = await this.executor.exec(['sh', '-c', script], content)
    const duration = Date.now() - startTime
    
    console.log(`[PodFS] 写入完成: ${targetFilePath}, 耗时: ${duration}ms`)
    
    this.checkExitCode(result.exitCode, result.stderr)

    return { path: targetFilePath }
  }

  async delete(path: string): Promise<void> {
    const normalizedPath = normalizePath(path)
    
    const script = this.buildScript([
      `TARGET=${escapeShellArg(normalizedPath)}`,
      'if [ ! -e "$TARGET" ]; then exit 44; fi',
      'rm -rf "$TARGET"'
    ])

    const result = await this.executor.exec(['sh', '-c', script])
    this.checkExitCode(result.exitCode, result.stderr)
  }

  async mkdir(path: string, recursive = true): Promise<void> {
    const normalizedPath = normalizePath(path)
    const mkdirCmd = recursive ? 'mkdir -p' : 'mkdir'
    
    const script = this.buildScript([
      `TARGET=${escapeShellArg(normalizedPath)}`,
      `${mkdirCmd} "$TARGET"`
    ])

    const result = await this.executor.exec(['sh', '-c', script])
    this.checkExitCode(result.exitCode, result.stderr)
  }

  /**
   * 构建 shell 脚本
   */
  private buildScript(commands: string[]): string {
    return commands.join('; ')
  }

  /**
   * 检查退出码并抛出相应错误
   * 
   * 使用映射表消除特殊情况
   */
  private checkExitCode(exitCode: number | null, stderr: Buffer): void {
    if (exitCode === null || exitCode === 0) {
      return
    }

    const errorInfo = EXIT_CODE_ERROR_MAP[exitCode]
    if (errorInfo) {
      throw new FileSystemError(
        errorInfo.message,
        errorInfo.code,
        errorInfo.statusCode
      )
    }

    // 未知错误，使用 stderr 内容
    const stderrText = stderr.toString('utf8').trim()
    throw new FileSystemError(
      stderrText || '操作失败',
      FileSystemErrorCode.EXEC_FAILED,
      500
    )
  }

  /**
   * 解析 ls -a -p 输出（旧方法，保留兼容）
   */
  private parseDirectoryListing(
    rawOutput: string,
    basePath: string
  ): FileEntry[] {
    const lines = rawOutput
      .split('\n')
      .map((line) => line.replace(/\r/g, '').trim())
      .filter((line) => line && line !== '.' && line !== '..')

    const entries = lines.map((line) => {
      const isDirectory = line.endsWith('/')
      const cleanName = isDirectory ? line.slice(0, -1) : line
      const type: FileEntry['type'] = isDirectory ? 'directory' : 'file'

      return {
        name: cleanName,
        path: joinPath(basePath, cleanName),
        type,
        isHidden: cleanName.startsWith('.')
      }
    })

    // 目录优先，字母排序
    return entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }

  /**
   * 解析自定义格式的文件列表（包含文件大小）
   * 
   * 输出格式（使用tab分隔）：
   * d\t0\tdirname          # 目录
   * f\t1234\tfilename.txt  # 文件
   */
  private parseDirectoryListingWithSize(
    rawOutput: string,
    basePath: string
  ): FileEntry[] {
    const lines = rawOutput
      .split('\n')
      .map((line) => line.replace(/\r/g, '').trim())
      .filter((line) => line.length > 0)

    console.log(`[PodFS] 解析行数: ${lines.length}, 前3行: ${JSON.stringify(lines.slice(0, 3))}`)

    const entries = lines.map((line) => {
      // 解析格式：类型\t大小\t名称
      const parts = line.split('\t')
      
      if (parts.length < 3) {
        return null
      }
      
      const typeChar = parts[0]
      const sizeStr = parts[1]
      const name = parts[2]
      
      // 跳过 . 和 ..
      if (name === '.' || name === '..') {
        return null
      }
      
      const isDirectory = typeChar === 'd'
      const type: FileEntry['type'] = isDirectory ? 'directory' : 'file'
      
      const entry: FileEntry = {
        name,
        path: joinPath(basePath, name),
        type,
        isHidden: name.startsWith('.')
      }
      
      // 文件才有大小
      if (!isDirectory) {
        const sizeBytes = parseInt(sizeStr, 10)
        if (!isNaN(sizeBytes)) {
          entry.size = sizeBytes
        }
      }
      
      return entry
    }).filter((entry): entry is FileEntry => entry !== null)

    // 目录优先，字母排序
    return entries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }
}
