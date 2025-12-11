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

// 解析find命令输出
function parseFindOutput(output: string): FileItem[] {
  const lines = output.trim().split('\n')
  const files: FileItem[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    
    // find命令输出格式: /path/to/file
    const fullPath = line.trim()
    const name = fullPath.split('/').pop() || fullPath
    
    // 简单判断是否为目录（实际应该用stat命令，但为了简化）
    const isDirectory = !name.includes('.')
    
    files.push({
      name,
      path: fullPath,
      type: isDirectory ? 'directory' : 'file'
    })
  }

  return files
}

export async function POST(request: NextRequest) {
  try {
    const { podName, namespace, container, path, pattern } = await request.json()

    if (!podName || !namespace || !container || !path || !pattern) {
      return NextResponse.json(
        { success: false, error: 'Pod name, namespace, container, path, and pattern are required' },
        { status: 400 }
      )
    }

    // 构建kubectl exec命令搜索文件
    // 使用find命令搜索文件名包含pattern的文件
    const kubectlArgs = [
      'exec',
      '-n', namespace,
      '-c', container,
      podName,
      '--',
      'find', path, '-name', `*${pattern}*`, '-type', 'f'
    ]

    try {
      // 执行kubectl命令搜索文件
      const output = await executeKubectlCommand(kubectlArgs)
      const files = parseFindOutput(output)

      return NextResponse.json({
        success: true,
        files,
        pattern,
        searchPath: path,
        podName,
        namespace,
        container
      })

    } catch (execError) {
      console.error('Failed to search files:', execError)
      
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'
      
      return NextResponse.json(
        {
          success: false,
          error: `搜索文件失败: ${errorMessage}`,
          details: 'Search path may not exist or may not be accessible'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to search files:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search files'
      },
      { status: 500 }
    )
  }
}