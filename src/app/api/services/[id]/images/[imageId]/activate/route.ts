import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await params

  const image = await prisma.serviceImage.findUnique({ where: { id: imageId } })

  if (!image || image.service_id !== id) {
    return NextResponse.json({ error: '镜像不存在' }, { status: 404 })
  }

  if ((image.build_status ?? '').toLowerCase() !== 'success') {
    return NextResponse.json({ error: '仅可选择构建成功的镜像进行部署' }, { status: 400 })
  }

  await prisma.$transaction([
    prisma.serviceImage.updateMany({
      where: {
        service_id: id,
        id: { not: imageId }
      },
      data: { is_active: false }
    }),
    prisma.serviceImage.update({
      where: { id: imageId },
      data: { is_active: true }
    }),
    prisma.service.update({
      where: { id },
      data: {
        built_image: image.full_image,
        status: 'pending'
      }
    })
  ])

  const [updatedImage, updatedService] = await Promise.all([
    prisma.serviceImage.findUnique({ where: { id: imageId } }),
    prisma.service.findUnique({ where: { id } })
  ])

  return NextResponse.json({
    success: true,
    image: updatedImage,
    service: updatedService
  })
}
