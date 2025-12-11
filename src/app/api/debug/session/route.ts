import { NextRequest, NextResponse } from 'next/server'

// 存储活跃的调试会话
const activeSessions = new Map<string, {
  podName: string
  namespace: string
  container: string
  startTime: Date
  lastActivity: Date
}>()

export async function POST(request: NextRequest) {
  try {
    const { podName, namespace, container } = await request.json()

    if (!podName || !namespace || !container) {
      return NextResponse.json(
        { success: false, error: 'Pod name, namespace, and container are required' },
        { status: 400 }
      )
    }

    const sessionId = `${namespace}:${podName}:${container}`
    const session = {
      podName,
      namespace,
      container,
      startTime: new Date(),
      lastActivity: new Date()
    }

    activeSessions.set(sessionId, session)

    console.log(`[Debug Session] Started session for ${sessionId}`)

    return NextResponse.json({
      success: true,
      sessionId,
      session: {
        podName,
        namespace,
        container,
        startTime: session.startTime.toISOString()
      }
    })

  } catch (error) {
    console.error('Failed to start debug session:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start debug session'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { podName, namespace, container } = await request.json()

    if (!podName || !namespace || !container) {
      return NextResponse.json(
        { success: false, error: 'Pod name, namespace, and container are required' },
        { status: 400 }
      )
    }

    const sessionId = `${namespace}:${podName}:${container}`
    const session = activeSessions.get(sessionId)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      )
    }

    activeSessions.delete(sessionId)

    console.log(`[Debug Session] Stopped session for ${sessionId}`)

    return NextResponse.json({
      success: true,
      sessionId,
      duration: Date.now() - session.startTime.getTime()
    })

  } catch (error) {
    console.error('Failed to stop debug session:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop debug session'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const sessions = Array.from(activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      ...session,
      duration: Date.now() - session.startTime.getTime()
    }))

    return NextResponse.json({
      success: true,
      sessions,
      total: sessions.length
    })

  } catch (error) {
    console.error('Failed to list debug sessions:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list debug sessions'
      },
      { status: 500 }
    )
  }
}

// 清理过期会话的辅助函数
export function cleanupExpiredSessions() {
  const now = Date.now()
  const maxAge = 30 * 60 * 1000 // 30分钟

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity.getTime() > maxAge) {
      activeSessions.delete(sessionId)
      console.log(`[Debug Session] Cleaned up expired session: ${sessionId}`)
    }
  }
}

// 更新会话活动时间
export function updateSessionActivity(sessionId: string) {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.lastActivity = new Date()
  }
}

// 导出会话管理函数
export { activeSessions }