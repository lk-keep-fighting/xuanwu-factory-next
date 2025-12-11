import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

// 执行kubectl命令
async function executeKubectlCommand(args: string[], input?: string): Promise<string> {
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

    // 如果有输入内容，写入到stdin
    if (input !== undefined) {
      kubectl.stdin.write(input)
      kubectl.stdin.end()
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { podName, namespace, container, path, content } = await request.json()

    if (!podName || !namespace || !container || !path || content === undefined) {
      return NextResponse.json(
        { success: false, error: 'Pod name, namespace, container, path, and content are required' },
        { status: 400 }
      )
    }

    // 使用tee命令写入文件内容
    // echo "content" | kubectl exec -i pod -- tee /path/to/file
    const kubectlArgs = [
      'exec',
      '-i',
      '-n', namespace,
      '-c', container,
      podName,
      '--',
      'tee', path
    ]

    try {
      // 执行kubectl命令写入文件
      await executeKubectlCommand(kubectlArgs, content)

      return NextResponse.json({
        success: true,
        message: 'File saved successfully',
        path,
        podName,
        namespace,
        container
      })

    } catch (execError) {
      console.error('Failed to write file:', execError)
      
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'
      
      return NextResponse.json(
        {
          success: false,
          error: `无法写入文件: ${errorMessage}`,
          details: 'File may not be writable or path may not exist'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to write file:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write file'
      },
      { status: 500 }
    )
  }
}