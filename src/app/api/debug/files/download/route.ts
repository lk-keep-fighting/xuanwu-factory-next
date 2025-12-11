import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

// 执行kubectl命令
async function executeKubectlCommand(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const kubectl = spawn('kubectl', args)
    const chunks: Buffer[] = []
    let stderr = ''

    kubectl.stdout.on('data', (data) => {
      chunks.push(Buffer.from(data))
    })

    kubectl.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    kubectl.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
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
      const fileBuffer = await executeKubectlCommand(kubectlArgs)
      
      // 从路径中提取文件名
      const fileName = path.split('/').pop() || 'download'
      
      // 返回文件内容作为下载
      return new NextResponse(fileBuffer as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': fileBuffer.length.toString()
        }
      })

    } catch (execError) {
      console.error('Failed to download file:', execError)
      
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'
      
      return NextResponse.json(
        {
          success: false,
          error: `无法下载文件: ${errorMessage}`,
          details: 'File may not exist or may not be readable'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to download file:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download file'
      },
      { status: 500 }
    )
  }
}