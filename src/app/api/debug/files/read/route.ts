import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

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

export async function POST(request: NextRequest) {
  try {
    const { podName, namespace, container, path } = await request.json()

    if (!podName || !namespace || !container || !path) {
      return NextResponse.json(
        { success: false, error: 'Pod name, namespace, container, and path are required' },
        { status: 400 }
      )
    }

    // 构建kubectl exec命令读取文件内容
    const kubectlArgs = [
      'exec',
      '-n', namespace,
      '-c', container,
      podName,
      '--',
      'cat', path
    ]

    try {
      // 执行kubectl命令读取文件
      const content = await executeKubectlCommand(kubectlArgs)

      return NextResponse.json({
        success: true,
        content,
        path,
        podName,
        namespace,
        container
      })

    } catch (execError) {
      console.error('Failed to read file:', execError)
      
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'
      
      return NextResponse.json(
        {
          success: false,
          error: `无法读取文件: ${errorMessage}`,
          details: 'File may not exist or may not be readable'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to read file:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      },
      { status: 500 }
    )
  }
}