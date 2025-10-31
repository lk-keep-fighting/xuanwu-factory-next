import { NextRequest, NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'

export async function GET(request: NextRequest) {
  const namespace = request.nextUrl.searchParams.get('namespace') ?? 'default'

  const services = await k8sService.listImportableServices(namespace)
  return NextResponse.json(services)
}
