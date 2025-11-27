import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Prometheus 配置
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus-k8s.kuboard:9090'

interface PrometheusQueryParams {
  query: string
  start: number
  end: number
  step: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const searchParams = request.nextUrl.searchParams
  
  // 解析查询参数
  const range = searchParams.get('range') || '1h' // 1h, 6h, 24h, 7d
  
  // 根据时间范围自动计算合适的 step，避免数据点过多
  const step = calculateStep(range)
  
  try {
    // 1. 获取服务信息
    const service = await prisma.service.findUnique({
      where: { id },
      select: {
        name: true,
        project: {
          select: { identifier: true }
        }
      }
    })

    if (!service) {
      return NextResponse.json({ error: '服务不存在' }, { status: 404 })
    }

    const namespace = service.project?.identifier?.trim()
    const serviceName = service.name?.trim()

    if (!namespace || !serviceName) {
      return NextResponse.json(
        { error: '服务信息不完整' },
        { status: 400 }
      )
    }

    // 2. 计算时间范围
    const now = Math.floor(Date.now() / 1000)
    const rangeSeconds = parseTimeRange(range)
    const start = now - rangeSeconds
    const end = now

    console.log(`[Metrics History] 查询 ${serviceName} 的历史数据: ${range}`)

    // 3. 查询 Prometheus - CPU 使用率
    const cpuQuery = `rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${serviceName}-.*",container!="",container!="POD"}[5m])`
    
    // 4. 查询 Prometheus - 内存使用
    const memoryQuery = `container_memory_working_set_bytes{namespace="${namespace}",pod=~"${serviceName}-.*",container!="",container!="POD"}`
    
    // 5. 查询资源限制
    const cpuLimitQuery = `kube_pod_container_resource_limits{namespace="${namespace}",pod=~"${serviceName}-.*",resource="cpu",unit="core"}`
    const memoryLimitQuery = `kube_pod_container_resource_limits{namespace="${namespace}",pod=~"${serviceName}-.*",resource="memory",unit="byte"}`

    // 并发查询
    const [cpuData, memoryData, cpuLimitData, memoryLimitData] = await Promise.all([
      queryPrometheus({ query: cpuQuery, start, end, step }),
      queryPrometheus({ query: memoryQuery, start, end, step }),
      queryPrometheus({ query: cpuLimitQuery, start: now, end: now, step: '1s' }),
      queryPrometheus({ query: memoryLimitQuery, start: now, end: now, step: '1s' })
    ])

    // 6. 处理数据
    const dataPoints = processMetricsData(cpuData, memoryData, cpuLimitData, memoryLimitData)

    console.log(`[Metrics History] 返回 ${dataPoints.length} 个数据点`)

    return NextResponse.json({
      serviceName,
      namespace,
      range,
      dataPoints
    })

  } catch (error: unknown) {
    console.error('[Metrics History] 查询失败:', error)
    const message = error instanceof Error ? error.message : '查询历史数据失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 根据时间范围计算合适的采样间隔
// 目标：保持数据点在 200-500 个之间，避免过多或过少
function calculateStep(range: string): string {
  const rangeSeconds = parseTimeRange(range)
  
  // 根据时间范围选择合适的 step
  if (rangeSeconds <= 3600) {
    // 1小时: 30秒间隔 = 120个点
    return '30s'
  } else if (rangeSeconds <= 21600) {
    // 6小时: 1分钟间隔 = 360个点
    return '1m'
  } else if (rangeSeconds <= 86400) {
    // 24小时: 3分钟间隔 = 480个点
    return '3m'
  } else {
    // 7天: 30分钟间隔 = 336个点
    return '30m'
  }
}

// 解析时间范围
function parseTimeRange(range: string): number {
  const units: Record<string, number> = {
    's': 1,
    'm': 60,
    'h': 3600,
    'd': 86400
  }
  
  const match = range.match(/^(\d+)([smhd])$/)
  if (!match) {
    return 3600 // 默认1小时
  }
  
  const value = parseInt(match[1], 10)
  const unit = match[2]
  return value * (units[unit] || 3600)
}

// 查询 Prometheus
async function queryPrometheus(params: PrometheusQueryParams) {
  const url = new URL(`${PROMETHEUS_URL}/api/v1/query_range`)
  url.searchParams.set('query', params.query)
  url.searchParams.set('start', params.start.toString())
  url.searchParams.set('end', params.end.toString())
  url.searchParams.set('step', params.step)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    },
    // 添加超时
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    throw new Error(`Prometheus 查询失败: ${response.statusText}`)
  }

  const data = await response.json()
  
  if (data.status !== 'success') {
    throw new Error(`Prometheus 返回错误: ${data.error || 'Unknown error'}`)
  }

  return data.data.result || []
}

// 处理 Prometheus 数据
function processMetricsData(
  cpuData: any[],
  memoryData: any[],
  cpuLimitData: any[],
  memoryLimitData: any[]
) {
  const dataPoints: any[] = []
  
  // 获取限制值（取第一个 Pod 的限制）
  const cpuLimitValue = cpuLimitData[0]?.values?.[0]?.[1] 
    ? parseFloat(cpuLimitData[0].values[0][1])
    : undefined
  const memoryLimitValue = memoryLimitData[0]?.values?.[0]?.[1]
    ? parseFloat(memoryLimitData[0].values[0][1])
    : undefined

  // 收集所有时间戳
  const timestampMap = new Map<number, { cpu: number; memory: number }>()
  
  // 处理 CPU 数据（rate 返回的是每秒的核心数）
  cpuData.forEach(series => {
    series.values?.forEach(([timestamp, value]: [number, string]) => {
      const existing = timestampMap.get(timestamp) || { cpu: 0, memory: 0 }
      existing.cpu += parseFloat(value) * 1000 // 转换为 millicores
      timestampMap.set(timestamp, existing)
    })
  })
  
  // 处理内存数据
  memoryData.forEach(series => {
    series.values?.forEach(([timestamp, value]: [number, string]) => {
      const existing = timestampMap.get(timestamp) || { cpu: 0, memory: 0 }
      existing.memory += parseFloat(value)
      timestampMap.set(timestamp, existing)
    })
  })

  // 转换为数据点数组
  Array.from(timestampMap.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([timestamp, { cpu, memory }]) => {
      dataPoints.push({
        timestamp: timestamp * 1000, // 转换为毫秒
        cpuUsed: cpu,
        cpuLimit: cpuLimitValue ? cpuLimitValue * 1000 : undefined, // 转换为 millicores
        cpuPercent: cpuLimitValue ? (cpu / (cpuLimitValue * 1000)) * 100 : undefined,
        memoryUsed: memory,
        memoryLimit: memoryLimitValue,
        memoryPercent: memoryLimitValue ? (memory / memoryLimitValue) * 100 : undefined
      })
    })

  return dataPoints
}
