'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MetricsDataPoint } from '@/components/services/ResourceUsageChart'

interface UseMetricsHistoryOptions {
  serviceId: string
  timeRange?: string // 时间范围：1h, 6h, 24h, 7d
  refreshInterval?: number // 刷新间隔（毫秒）
  enabled?: boolean // 是否启用自动刷新
  mode?: 'prometheus' | 'polling' // 数据源模式
}



export function useMetricsHistory({
  serviceId,
  timeRange = '1h', // 默认查询1小时
  refreshInterval = 60000, // 默认60秒刷新一次（Prometheus 模式）
  enabled = true,
  mode = 'prometheus' // 默认使用 Prometheus
}: UseMetricsHistoryOptions) {
  const [dataPoints, setDataPoints] = useState<MetricsDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // 从 Prometheus 获取历史数据
  const fetchPrometheusData = useCallback(async (range?: string) => {
    if (!serviceId || !mountedRef.current) return

    const queryRange = range || timeRange
    setIsLoading(true)
    setError(null)

    try {
      console.log(`[useMetricsHistory] 查询 Prometheus 历史数据: ${queryRange}`)
      
      const response = await fetch(
        `/api/services/${serviceId}/metrics-history?range=${queryRange}`
      )
      
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      if (data.dataPoints && Array.isArray(data.dataPoints)) {
        setDataPoints(data.dataPoints)
        console.log(`[useMetricsHistory] 获取到 ${data.dataPoints.length} 个数据点`)
      } else {
        setDataPoints([])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '查询失败'
      console.error('[useMetricsHistory] Prometheus 查询失败:', message)
      setError(message)
      setDataPoints([])
    } finally {
      setIsLoading(false)
    }
  }, [serviceId, timeRange])

  // 启动自动刷新
  useEffect(() => {
    if (!enabled || !serviceId || mode !== 'prometheus') {
      return
    }

    // 立即获取一次
    void fetchPrometheusData()

    // 设置定时器（Prometheus 模式刷新间隔可以更长）
    intervalRef.current = setInterval(() => {
      void fetchPrometheusData()
    }, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, serviceId, mode, refreshInterval, fetchPrometheusData])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // 手动刷新
  const refresh = useCallback((range?: string) => {
    void fetchPrometheusData(range)
  }, [fetchPrometheusData])

  // 清除历史数据
  const clear = useCallback(() => {
    setDataPoints([])
    setError(null)
  }, [])

  return {
    dataPoints,
    isLoading,
    error,
    refresh,
    clear
  }
}
