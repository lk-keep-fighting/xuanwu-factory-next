import { NextResponse } from 'next/server'

/**
 * 健康检查端点
 * 用于 Kubernetes 存活探针和就绪探针
 */
export async function GET() {
  try {
    // 基础健康检查
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    }

    return NextResponse.json(healthStatus, { status: 200 })
  } catch (error) {
    console.error('[Health Check] Error:', error)
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
