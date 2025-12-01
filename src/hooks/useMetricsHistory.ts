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
    if (!serviceId || !mountedRef.current) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
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
      } else {
        setDataPoints([])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '查询失败'
      console.error('[useMetricsHistory] 查询失败:', message)
      setError(message)
      setDataPoints([])
    } finally {
      setIsLoading(false)
    }
  }, [serviceId])

  // 当 timeRange 变化时，立即重新获取数据
  useEffect(() => {
    if (!enabled || !serviceId || mode !== 'prometheus') {
      return
    }

    void fetchPrometheusData(timeRange)
  }, [timeRange, enabled, serviceId, mode, fetchPrometheusData])

  // 启动自动刷新
  useEffect(() => {
    if (!enabled || !serviceId || mode !== 'prometheus') {
      return
    }

    // 设置定时器（Prometheus 模式刷新间隔可以更长）
    intervalRef.current = setInterval(() => {
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
    mountedRef.current = true
    
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // 手动刷新
  const refresh = useCallback((range?: string) => {
    const rangeToUse = range || timeRange
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
