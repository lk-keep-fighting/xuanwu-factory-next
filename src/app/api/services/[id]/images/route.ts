import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const images = await prisma.serviceImage.findMany({
    where: { service_id: id },
    orderBy: { created_at: 'desc' }
  })

  return NextResponse.json(images)
}
