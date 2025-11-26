import { NextResponse } from 'next/server'

/**
 * 运行时配置API
 * 服务端读取环境变量并暴露给客户端
 */
export async function GET() {
  return NextResponse.json({
    wsUrl: process.env.WS_URL || null,
  })
}
