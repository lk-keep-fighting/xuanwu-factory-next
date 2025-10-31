import { NextResponse } from 'next/server'
import { k8sService } from '@/lib/k8s'

export async function GET() {
  try {
    const namespaces = await k8sService.listNamespaces()
    return NextResponse.json(namespaces)
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法获取命名空间列表'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
