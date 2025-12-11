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

// 获取服务的Pod信息 - 使用与现有文件管理器相同的逻辑
async function getServicePodInfo(serviceId: string) {
  try {
    // 首先查询数据库获取服务名称和项目标识符
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        name: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      throw new Error('Service not found')
    }

    const serviceName = service.name?.trim()
    if (!serviceName) {
      throw new Error('Service name is missing')
    }

    const namespace = service.project?.identifier?.trim()
    if (!namespace) {
      throw new Error('Project identifier is missing')
    }

    // 使用服务名称作为标签选择器查找Pod
    const kubectlArgs = [
      'get', 'pods',
      '-n', namespace,
      '-l', `app=${serviceName}`,
      '-o', 'jsonpath={.items[0].metadata.name},{.items[0].spec.containers[0].name}'
    ]
    
    const output = await executeKubectlCommand(kubectlArgs)
    const [podName, containerName] = output.trim().split(',')
    
    if (!podName || podName === '<no value>') {
      throw new Error(`No pod found for service '${serviceName}' in namespace '${namespace}'`)
    }
    
    return { 
      podName, 
      namespace, 
      containerName: containerName || serviceName // 使用服务名作为默认容器名
    }
  } catch (error) {
    throw new Error(`Failed to find pod for service: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceId } = await params
    const { path, content } = await request.json()

    if (!serviceId || !path || content === undefined) {
      return NextResponse.json(
        { success: false, error: 'Service ID, file path, and content are required' },
        { status: 400 }
      )
    }

    // 获取服务对应的Pod信息
    const { podName, namespace, containerName } = await getServicePodInfo(serviceId)

    // 使用tee命令写入文件内容
    const kubectlArgs = [
      'exec',
      '-i',
      '-n', namespace,
      '-c', containerName,
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
        serviceId,
        podName,
        namespace,
        containerName
      })

    } catch (execError) {
      console.error('Failed to save file to pod:', execError)
      
      const errorMessage = execError instanceof Error ? execError.message : 'Unknown error'
      
      return NextResponse.json(
        {
          success: false,
          error: `无法保存文件: ${errorMessage}`,
          details: 'File may not be writable, path may not exist, or pod may not be running'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Failed to save service file:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file'
      },
      { status: 500 }
    )
  }
}