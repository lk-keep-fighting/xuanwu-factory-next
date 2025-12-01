/**
 * kubectl cp 文件系统实现
 * 
 * 使用 kubectl cp 命令上传/下载文件
 * 性能远优于 WebSocket 方式
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile as fsWriteFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { FileSystemError, FileSystemErrorCode } from './types'

const execAsync = promisify(exec)

export type KubectlPodInfo = {
  namespace: string
  podName: string
  containerName?: string
}

/**
 * 使用 kubectl cp 上传文件
 */
export async function uploadFileViaKubectl(
  podInfo: KubectlPodInfo,
  remotePath: string,
  fileName: string,
  content: Buffer
): Promise<{ path: string }> {
  const { namespace, podName, containerName } = podInfo
  
  // 生成临时文件路径
  const tempDir = tmpdir()
  const tempFileName = `upload-${randomBytes(8).toString('hex')}-${fileName}`
  const tempFilePath = join(tempDir, tempFileName)
  
  // 目标路径
  const remoteFilePath = remotePath.endsWith('/') 
    ? `${remotePath}${fileName}` 
    : `${remotePath}/${fileName}`
  
  const fileSizeKB = (content.length / 1024).toFixed(2)
  console.log(`[KubectlFS] 开始上传: ${remoteFilePath}, 大小: ${fileSizeKB}KB`)
  
  try {
    // 1. 写入临时文件
    await fsWriteFile(tempFilePath, content)
    console.log(`[KubectlFS] 临时文件已创建: ${tempFilePath}`)
    
    // 2. 构建 kubectl cp 命令（使用数组形式避免shell转义问题）
    const args = ['cp', tempFilePath, `${namespace}/${podName}:${remoteFilePath}`]
    if (containerName) {
      args.push('-c', containerName)
    }
    
    const kubectlCmd = `kubectl ${args.join(' ')}`
    console.log(`[KubectlFS] 执行命令: ${kubectlCmd}`)
    
    // 3. 执行 kubectl cp（使用spawn避免shell转义问题）
    const startTime = Date.now()
    const { spawn } = await import('child_process')
    
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn('kubectl', args, {
        timeout: 30000
      })
      
      let stdout = ''
      let stderr = ''
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('error', (error) => {
        reject(error)
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`kubectl cp 退出码: ${code}\n${stderr}`))
        }
      })
    })
    
    const duration = Date.now() - startTime
    const { stdout, stderr } = result
    
    if (stderr && !stderr.includes('tar:')) {
      // kubectl cp 有时会输出 tar 警告，这些可以忽略
      console.warn(`[KubectlFS] stderr: ${stderr}`)
    }
    
    console.log(`[KubectlFS] 上传完成: ${remoteFilePath}, 耗时: ${duration}ms`)
    
    return { path: remoteFilePath }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败'
    console.error(`[KubectlFS] 上传失败:`, error)
    
    // 如果是权限问题，尝试使用 kubectl exec 方式
    if (message.includes('Permission denied')) {
      console.log(`[KubectlFS] kubectl cp 权限不足，尝试使用 kubectl exec 方式`)
      try {
        return await uploadFileViaKubectlExec(podInfo, remoteFilePath, content, tempFilePath)
      } catch (execError) {
        console.error(`[KubectlFS] kubectl exec 方式也失败:`, execError)
        throw new FileSystemError(
          '权限不足，无法写入目标目录',
          FileSystemErrorCode.EXEC_FAILED,
          403
        )
      }
    }
    
    // 解析其他错误类型
    if (message.includes('No such file or directory')) {
      throw new FileSystemError(
        '目标目录不存在',
        FileSystemErrorCode.NOT_FOUND,
        404
      )
    }
    
    if (message.includes('timed out') || message.includes('timeout')) {
      throw new FileSystemError(
        'kubectl cp 超时',
        FileSystemErrorCode.EXEC_FAILED,
        408
      )
    }
    
    throw new FileSystemError(
      `kubectl cp 失败: ${message}`,
      FileSystemErrorCode.EXEC_FAILED,
      500
    )
    
  } finally {
    // 4. 清理临时文件
    try {
      await unlink(tempFilePath)
      console.log(`[KubectlFS] 临时文件已删除: ${tempFilePath}`)
    } catch (cleanupError) {
      console.warn(`[KubectlFS] 清理临时文件失败:`, cleanupError)
    }
  }
}

/**
 * 使用 kubectl exec 上传文件（备用方案，用于权限受限的目录）
 */
async function uploadFileViaKubectlExec(
  podInfo: KubectlPodInfo,
  remoteFilePath: string,
  content: Buffer,
  tempFilePath: string
): Promise<{ path: string }> {
  const { namespace, podName, containerName } = podInfo
  
  const fileSizeKB = (content.length / 1024).toFixed(2)
  console.log(`[KubectlFS] 使用 kubectl exec 方式上传: ${remoteFilePath}, 大小: ${fileSizeKB}KB`)
  
  try {
    const startTime = Date.now()
    const { spawn } = await import('child_process')
    
    // 使用 kubectl exec 配合 dd 命令写入文件
    // dd 命令可以从 stdin 读取并写入文件
    const args = [
      'exec',
      '-i', // 保持 stdin 打开
      podName,
      '-n',
      namespace
    ]
    
    if (containerName) {
      args.push('-c', containerName)
    }
    
    args.push('--', 'dd', `of=${remoteFilePath}`)
    
    const kubectlCmd = `kubectl ${args.join(' ')}`
    console.log(`[KubectlFS] 执行命令: ${kubectlCmd}`)
    
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn('kubectl', args, {
        timeout: 30000
      })
      
      let stdout = ''
      let stderr = ''
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('error', (error) => {
        reject(error)
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`kubectl exec 退出码: ${code}\n${stderr}`))
        }
      })
      
      // 将文件内容写入 stdin
      proc.stdin?.write(content)
      proc.stdin?.end()
    })
    
    const duration = Date.now() - startTime
    const { stderr } = result
    
    // dd 命令会输出统计信息到 stderr，这是正常的
    if (stderr && !stderr.includes('records in') && !stderr.includes('records out')) {
      console.warn(`[KubectlFS] stderr: ${stderr}`)
    }
    
    console.log(`[KubectlFS] kubectl exec 上传完成: ${remoteFilePath}, 耗时: ${duration}ms`)
    
    return { path: remoteFilePath }
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'kubectl exec 上传失败'
    console.error(`[KubectlFS] kubectl exec 上传失败:`, error)
    throw new Error(message)
  }
}

/**
 * 使用 kubectl cp 下载文件
 */
export async function downloadFileViaKubectl(
  podInfo: KubectlPodInfo,
  remotePath: string
): Promise<Buffer> {
  const { namespace, podName, containerName } = podInfo
  
  // 生成临时文件路径
  const tempDir = tmpdir()
  const tempFileName = `download-${randomBytes(8).toString('hex')}`
  const tempFilePath = join(tempDir, tempFileName)
  
  console.log(`[KubectlFS] 开始下载: ${remotePath}`)
  
  try {
    // 1. 构建 kubectl cp 命令（使用数组形式避免shell转义问题）
    const args = ['cp', `${namespace}/${podName}:${remotePath}`, tempFilePath]
    if (containerName) {
      args.push('-c', containerName)
    }
    
    const kubectlCmd = `kubectl ${args.join(' ')}`
    console.log(`[KubectlFS] 执行命令: ${kubectlCmd}`)
    
    // 2. 执行 kubectl cp（使用spawn避免shell转义问题）
    const startTime = Date.now()
    const { spawn } = await import('child_process')
    
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn('kubectl', args, {
        timeout: 30000
      })
      
      let stdout = ''
      let stderr = ''
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
      
      proc.on('error', (error) => {
        reject(error)
      })
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`kubectl cp 退出码: ${code}\n${stderr}`))
        }
      })
    })
    
    const duration = Date.now() - startTime
    const { stderr } = result
    
    if (stderr && !stderr.includes('tar:')) {
      console.warn(`[KubectlFS] stderr: ${stderr}`)
    }
    
    // 3. 读取临时文件
    const fs = await import('fs/promises')
    const content = await fs.readFile(tempFilePath)
    
    const fileSizeKB = (content.length / 1024).toFixed(2)
    console.log(`[KubectlFS] 下载完成: ${remotePath}, 大小: ${fileSizeKB}KB, 耗时: ${duration}ms`)
    
    return content
    
  } catch (error) {
    const message = error instanceof Error ? error.message : '下载失败'
    console.error(`[KubectlFS] 下载失败:`, error)
    
    if (message.includes('No such file or directory')) {
      throw new FileSystemError(
        '文件不存在',
        FileSystemErrorCode.NOT_FOUND,
        404
      )
    }
    
    throw new FileSystemError(
      `kubectl cp 失败: ${message}`,
      FileSystemErrorCode.EXEC_FAILED,
      500
    )
    
  } finally {
    // 4. 清理临时文件
    try {
      await unlink(tempFilePath)
      console.log(`[KubectlFS] 临时文件已删除: ${tempFilePath}`)
    } catch (cleanupError) {
      console.warn(`[KubectlFS] 清理临时文件失败:`, cleanupError)
    }
  }
}

/**
 * 检查 kubectl 是否可用
 */
export async function checkKubectlAvailable(): Promise<boolean> {
  try {
    // 检查 kubectl 命令是否存在
    const { stdout } = await execAsync('kubectl version --client --output=json', { timeout: 5000 })
    console.log('[KubectlFS] kubectl 客户端版本:', JSON.parse(stdout).clientVersion?.gitVersion || 'unknown')
    
    // 检查是否能访问 K8s API（in-cluster 或 kubeconfig）
    // 使用更轻量的命令来检查连接性
    try {
      await execAsync('kubectl get --raw /healthz', { timeout: 3000 })
      console.log('[KubectlFS] kubectl 可用: ✅ 已连接到集群')
      return true
    } catch (clusterError) {
      console.warn('[KubectlFS] kubectl 已安装但无法连接到集群:', clusterError)
      return false
    }
  } catch (error) {
    console.error('[KubectlFS] kubectl 不可用:', error)
    return false
  }
}
