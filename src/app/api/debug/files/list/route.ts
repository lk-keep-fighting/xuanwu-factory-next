import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

interface FileItem {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  permissions?: string
}

// 执行kubectl命令
async function executeKubectlCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const kubectl = spawn('kubectl', args)
    let stdout = ''
    let stderr = ''

    kubectl.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    kubectl.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    kubectl.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`kubectl command failed: ${stderr}`))
      }
    })

    kubectl.on('error', (error) => {
      reject(error)
    })
  })
}

// 解析ls -la输出
function parseLsOutput(output: string, basePath: string): FileItem[] {
  const lines = output.trim().split('\n')
  const files: FileItem[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    
    // 跳过总计行
    if (line.startsWith('total ')) continue
    
    // 解析ls -la输出格式
    // drwxr-xr-x 2 root root 4096 Dec 11 10:30 dirname
    // -rw-r--r-- 1 root root 1024 Dec 11 10:30 filename
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue

    const permissions = parts[0]
    const size = parseInt(parts[4]) || 0
    const month = parts[5]
    const day = parts[6]
    const time = parts[7]
    const name = parts.slice(8).join(' ')

    // 跳过当前目录和父目录的特殊条目
    if (name === '.' || name === '..') continue

    const isDirectory = permissions.startsWith('d')
    const fullPath = basePath === '/' ? `/${name}` : `${basePath}/${name}`

    files.push({
      name,
      path: fullPath,
      type: isDirectory ? 'directory' : 'file',
      size: isDirectory ? undefined : size,
      permissions,
      modified: `${month} ${day} ${time}`
    })
  }

  return files
}

export async function POST(request: NextRequest) {
  try {
    const { podName, namespace, container, path } = await request.json()

    if (!podName || !namespace || !container || !path) {
      return NextResponse.json(
        { success: false, error: 'Pod name, namespace, container, and path are required' },
        { status: 400 }
      )
    }

    // 构建kubectl exec命令
    const kubectlArgs = [
      'exec',
      '-n', namespace,
      '-c', container,
      podName,
      '--',
      'ls', '-la', path
    ]

    try {
      // 执行kubectl命令获取目录内容
      const output = await executeKubectlCommand(kubectlArgs)
      const files = parseLsOutput(output, path)

      // 如果不是根目录，添加返回上级目录的选项
      if (path !== '/') {
        const parentPath = path.split('/').slice(0, -1).join('/') || '/'
        files.unshift({
          name: '..',
          path: parentPath,
          type: 'directory',
          permissions: 'drwxr-xr-x'
        })
      }

      return NextResponse.json({
        success: true,
        files,
        path,
        podName,
        namespace,
        container
      })

    } catch (execError) {
      console.error('Failed to execute kubectl command:', execError)
      
      // 如果kubectl命令失败，返回友好的错误信息
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'
      
      return NextResponse.json(
        {
          success: false,
          error: `无法访问Pod文件系统: ${errorMessage}`,
          details: 'Please ensure the pod is running and kubectl is properly configured'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to list files:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files'
      },
      { status: 500 }
    )
  }
}