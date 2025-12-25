import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * 开放API健康检查接口
 * 用于检查开放API服务的可用性
 */
export async function GET() {
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'healthy',
        api: 'healthy'
      }
    })
  } catch (error) {
    console.error('Open API health check failed:', error)
    
    return NextResponse.json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'unhealthy',
        api: 'healthy'
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}