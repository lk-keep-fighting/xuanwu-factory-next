import { NextRequest, NextResponse } from 'next/server'
import { FileSystemError } from '@/lib/filesystem/types'
import { readFile } from '@/service/fileManagerSvc'

const createErrorResponse = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status })

const encodeFileName = (fileName: string) => {
  const asciiName = fileName.replace(/[^\x20-\x7E]+/g, '') || fileName
  return {
    ascii: asciiName,
    encoded: encodeURIComponent(fileName)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const targetPath = searchParams.get('path')

  if (!targetPath || !targetPath.trim()) {
    return createErrorResponse('请提供要下载的文件路径', 400)
  }

  try {
    const fileBuffer = await readFile(id, targetPath)
    const fileNameCandidate = targetPath.split('/').filter(Boolean).pop() || 'download.bin'
    const { ascii, encoded } = encodeFileName(fileNameCandidate)

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
      }
    })
  } catch (error) {
    if (error instanceof FileSystemError) {
      return createErrorResponse(error.message, error.statusCode)
    }

    const message = error instanceof Error ? error.message : '下载文件失败'
    return createErrorResponse(message, 500)
  }
}
