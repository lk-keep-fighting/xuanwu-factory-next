import { NextRequest, NextResponse } from 'next/server'
import { FileSystemError } from '@/lib/filesystem/types'
import { listFiles, writeFile } from '@/service/fileManagerSvc'

const createErrorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const targetPath = searchParams.get('path') ?? '/'

  try {
    const payload = await listFiles(id, targetPath)
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

  const arrayBuffer = await uploadBlob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const result = await writeFile(id, targetPath, fileName, buffer)
    return NextResponse.json({ success: true, path: result.path })
  } catch (error) {
    if (error instanceof FileSystemError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '上传文件失败'
    return createErrorResponse(message, 500)
  }
}
