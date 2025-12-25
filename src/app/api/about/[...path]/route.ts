import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const pathWithMd = path.map((p, i) =>
      i === path.length - 1 && !p.endsWith('.md') ? `${p}.md` : p
    )
    const filePath = join(process.cwd(), 'about', ...pathWithMd)
    const content = await readFile(filePath, 'utf-8')

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}
