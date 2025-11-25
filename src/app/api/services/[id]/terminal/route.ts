import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'

/**
 * WebSocket终端连接
 * 注意：Next.js API Routes不直接支持WebSocket
 * 这个端点返回必要的信息，实际WebSocket连接需要通过自定义服务器处理
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: serviceId } = await params

  try {
    // 获取服务信息
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        name: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      return new Response(JSON.stringify({ error: '服务不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const namespace = service.project?.identifier?.trim()
    const serviceName = service.name?.trim()

    if (!namespace || !serviceName) {
      return new Response(
        JSON.stringify({ error: '服务配置不完整' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 检查是否为WebSocket升级请求
    const upgrade = request.headers.get('upgrade')
    if (upgrade?.toLowerCase() === 'websocket') {
      // Next.js Edge Runtime不支持WebSocket
      // 需要使用Node.js runtime和自定义WebSocket处理
      return new Response(
        JSON.stringify({
          error: 'WebSocket connections are not supported in this configuration',
          message: '请使用ws库和自定义服务器实现WebSocket终端'
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 返回连接信息（用于SSE或轮询方案）
    return new Response(
      JSON.stringify({
        serviceName,
        namespace,
        message: '请使用WebSocket客户端连接'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('[Terminal] Error:', error)
    const message = error instanceof Error ? error.message : '服务器错误'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * 执行命令（REST API方式，用于单次命令执行）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: serviceId } = await params

  try {
    const body = await request.json()
    const { command } = body as { command?: string }

    if (!command) {
      return new Response(
        JSON.stringify({ error: '缺少命令参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 获取服务信息
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        name: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      return new Response(
        JSON.stringify({ error: '服务不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const namespace = service.project?.identifier?.trim() || 'default'
    const serviceName = service.name?.trim()

    if (!serviceName) {
      return new Response(
        JSON.stringify({ error: '服务名称缺失' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 执行命令
    const result = await k8sService.execCommand(serviceName, namespace, command)

    return new Response(
      JSON.stringify({
        output: result.stdout,
        error: result.stderr,
        exitCode: result.exitCode
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('[Terminal] Exec error:', error)
    const message = error instanceof Error ? error.message : '命令执行失败'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
