import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { k8sService } from '@/lib/k8s'
import { ServiceType, DatabaseType, type DatabaseService } from '@/types/project'
import { validateMySQLConfig } from '@/lib/mysql-config-templates'

/**
 * 获取 MySQL 配置
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const service = await prisma.service.findUnique({
      where: { id }
    })

    if (!service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    if (service.type !== ServiceType.DATABASE || service.database_type !== DatabaseType.MYSQL) {
      return NextResponse.json(
        { error: '该服务不是 MySQL 数据库服务' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      mysql_config: (service as any).mysql_config || {}
    })
  } catch (error: unknown) {
    console.error('[MySQL Config][GET] 获取配置失败:', error)
    const message = error instanceof Error ? error.message : '获取配置失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * 更新 MySQL 配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { mysql_config, restart = false } = body

    if (!mysql_config || typeof mysql_config !== 'object') {
      return NextResponse.json(
        { error: '配置数据格式不正确' },
        { status: 400 }
      )
    }

    // 验证配置
    const validation = validateMySQLConfig(mysql_config)
    if (!validation.valid) {
      return NextResponse.json(
        { error: '配置验证失败', errors: validation.errors },
        { status: 400 }
      )
    }

    // 查询服务
    const service = await prisma.service.findUnique({
      where: { id }
    })

    if (!service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    if (service.type !== ServiceType.DATABASE || service.database_type !== DatabaseType.MYSQL) {
      return NextResponse.json(
        { error: '该服务不是 MySQL 数据库服务' },
        { status: 400 }
      )
    }

    // 更新数据库记录
    const updatedService = await prisma.service.update({
      where: { id },
      data: { mysql_config: mysql_config as any }
    })

    // 更新 K8s ConfigMap
    try {
      await k8sService.updateMySQLConfigMap(
        updatedService as unknown as DatabaseService,
        'default'
      )

      // 如果需要重启
      if (restart) {
        await k8sService.restartStatefulSet(service.name, 'default')
      }
    } catch (k8sError: unknown) {
      console.error('[MySQL Config][PUT] K8s 更新失败:', k8sError)
      // K8s 更新失败，但数据库已更新，返回警告
      return NextResponse.json({
        success: true,
        service: updatedService,
        warning: 'K8s 配置更新失败，请手动重启服务',
        k8s_error: k8sError instanceof Error ? k8sError.message : '未知错误'
      })
    }

    return NextResponse.json({
      success: true,
      service: updatedService,
      restarted: restart
    })
  } catch (error: unknown) {
    console.error('[MySQL Config][PUT] 更新配置失败:', error)
    const message = error instanceof Error ? error.message : '更新配置失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
