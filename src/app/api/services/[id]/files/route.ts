import { NextRequest, NextResponse } from 'next/server'
import { FileSystemError } from '@/lib/filesystem/types'
import { listFiles, writeFileViaKubectl } from '@/service/fileManagerSvc'
import { checkKubectlAvailable } from '@/lib/filesystem/kubectl-filesystem'

const createErrorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

// 检查 kubectl 是否可用（启动时检查一次）
let kubectlAvailable: boolean | null = null
async function isKubectlAvailable(): Promise<boolean> {
  if (kubectlAvailable === null) {
    kubectlAvailable = await checkKubectlAvailable()
    console.log(`[FileUpload] kubectl 可用性: ${kubectlAvailable ? '✅ 可用' : '❌ 不可用'}`)
  }
  return kubectlAvailable
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const targetPath = searchParams.get('path') ?? '/'

  try {
    console.log(`[FileList] 开始获取文件列表: serviceId=${id}, path=${targetPath}`)
    
    // 添加超时保护
    const listPromise = listFiles(id, targetPath)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error(`[FileList] 获取文件列表超时: serviceId=${id}, path=${targetPath}`)
        reject(new Error('获取文件列表超时（60秒），请检查Pod状态'))
      }, 60000) // 60秒超时（增加到60秒）
    })

    const payload = await Promise.race([listPromise, timeoutPromise])
    console.log(`[FileList] 获取成功: ${payload.entries.length} 个条目`)
    
    const jsonString = JSON.stringify(payload)
    const byteLength = Buffer.byteLength(jsonString, 'utf8')
    
    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': byteLength.toString()
      }
    })
  } catch (error) {
    console.error(`[FileList] 获取失败: serviceId=${id}, path=${targetPath}`, error)
    
    if (error instanceof FileSystemError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '获取文件列表失败'
    return createErrorResponse(message, 500)
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await request.formData()
  const pathField = formData.get('path')
  const targetPath = typeof pathField === 'string' && pathField.trim() ? pathField : '/'
  const fileField = formData.get('file')

  if (!fileField || typeof (fileField as Blob).arrayBuffer !== 'function') {
    return createErrorResponse('未检测到上传文件', 400)
  }

  const uploadBlob = fileField as Blob & { name?: string }
  const inferredName = typeof uploadBlob.name === 'string' ? uploadBlob.name : ''
  const fallbackNameField = formData.get('filename')
  const fallbackName = typeof fallbackNameField === 'string' ? fallbackNameField : ''
  const fileName = inferredName?.trim() || fallbackName.trim()

  if (!fileName) {
    return createErrorResponse('文件名不能为空', 400)
  }

  const arrayBuffer = await uploadBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const fileSizeKB = (buffer.length / 1024).toFixed(2)
    console.log(`[FileUpload] 开始上传: serviceId=${id}, path=${targetPath}, fileName=${fileName}, size=${fileSizeKB}KB`)
    
    // 检查 kubectl 是否可用
    const kubectlAvailable = await isKubectlAvailable()
    
    if (!kubectlAvailable) {
      console.error(`[FileUpload] kubectl 不可用，无法上传文件`)
      return createErrorResponse(
        'kubectl 不可用，请确保 kubectl 已安装并配置正确',
        503
      )
    }
    
    // 使用 kubectl cp 方式上传
    console.log(`[FileUpload] 使用 kubectl cp 方式上传`)
    const result = await writeFileViaKubectl(id, targetPath, fileName, buffer)
    
    console.log(`[FileUpload] 上传成功: ${result.path}`)
    return NextResponse.json({ 
      success: true, 
      path: result.path
    })
  } catch (error) {
    console.error(`[FileUpload] 上传失败: serviceId=${id}, fileName=${fileName}`, error)
    
    if (error instanceof FileSystemError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '上传文件失败'
    return createErrorResponse(message, 500)
  }
}
