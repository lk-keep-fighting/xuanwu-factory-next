'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MetricsDataPoint } from '@/types/service-tabs'

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
  const fetchPrometheusData = useCallback(async (range: string) => {
    console.log(`[useMetricsHistory] fetchPrometheusData 调用，range: ${range}, serviceId: ${serviceId}, mounted: ${mountedRef.current}`)
    if (!serviceId || !mountedRef.current) {
      console.log('[useMetricsHistory] 跳过获取：serviceId 或 mounted 检查失败')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`[useMetricsHistory] 查询 Prometheus 历史数据: ${range}`)
      
      const response = await fetch(
        `/api/services/${serviceId}/metrics-history?range=${range}`
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
  }, [serviceId])

  // 当 timeRange 变化时，立即重新获取数据
  useEffect(() => {
    if (!enabled || !serviceId || mode !== 'prometheus') {
      console.log(`[useMetricsHistory] 跳过 timeRange 变化处理：enabled=${enabled}, serviceId=${serviceId}, mode=${mode}`)
      return
    }

    console.log(`[useMetricsHistory] timeRange 变化，重新获取数据: ${timeRange}`)
    console.log(`[useMetricsHistory] 准备调用 fetchPrometheusData，函数类型:`, typeof fetchPrometheusData)
    void fetchPrometheusData(timeRange)
    console.log(`[useMetricsHistory] fetchPrometheusData 调用完成`)
  }, [timeRange, enabled, serviceId, mode, fetchPrometheusData])

  // 启动自动刷新
  useEffect(() => {
    if (!enabled || !serviceId || mode !== 'prometheus') {
      return
    }

    // 设置定时器（Prometheus 模式刷新间隔可以更长）
    intervalRef.current = setInterval(() => {
      console.log(`[useMetricsHistory] 定时刷新，使用 timeRange: ${timeRange}`)
      void fetchPrometheusData(timeRange)
    }, refreshInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, serviceId, mode, refreshInterval, timeRange, fetchPrometheusData])

  // 组件挂载和卸载时管理 mountedRef
  useEffect(() => {
    console.log('[useMetricsHistory] 组件挂载，设置 mounted = true')
    mountedRef.current = true
    
    return () => {
      console.log('[useMetricsHistory] 组件卸载，设置 mounted = false')
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // 手动刷新
  const refresh = useCallback((range?: string) => {
    const rangeToUse = range || timeRange
    console.log(`[useMetricsHistory] 手动刷新，使用 range: ${rangeToUse}`)
    void fetchPrometheusData(rangeToUse)
  }, [fetchPrometheusData, timeRange])

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
