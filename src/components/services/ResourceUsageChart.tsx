'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { MetricsDataPoint } from '@/types/service-tabs'

interface ResourceUsageChartProps {
  data: MetricsDataPoint[]
  showCpu?: boolean
  showMemory?: boolean
  height?: number
}

// 格式化时间显示
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化 CPU 值（millicores）
const formatCpu = (value: number) => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} cores`
  }
  return `${value.toFixed(0)}m`
}

// 格式化内存值（bytes）
const formatMemory = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

// 自定义 Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) {
    return null
  }

  // 从 payload 中获取原始数据
  const dataPoint = payload[0]?.payload

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 mb-2">{formatTime(label)}</p>
      {payload.map((entry: any, index: number) => {
        const isCpu = entry.dataKey === 'cpuPercent'
        const actualValue = isCpu 
          ? formatCpu(dataPoint?.cpuUsed ?? 0)
          : formatMemory(dataPoint?.memoryUsed ?? 0)
        
        return (
          <div key={index} className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium text-gray-900">
              {entry.value.toFixed(1)}% ({actualValue})
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function ResourceUsageChart({
  data,
  showCpu = true,
  showMemory = true,
  height = 300
}: ResourceUsageChartProps) {
  // 准备图表数据
  const chartData = useMemo(() => {
    return data.map(point => ({
      timestamp: point.timestamp,
      time: formatTime(point.timestamp),
      cpuPercent: point.cpuPercent ?? 0,
      memoryPercent: point.memoryPercent ?? 0,
      cpuUsed: point.cpuUsed,
      memoryUsed: point.memoryUsed
    }))
  }, [data])

  // 计算统计信息
  const stats = useMemo(() => {
    if (data.length === 0) {
      return {
        cpuAvg: 0,
        cpuMax: 0,
        cpuMaxValue: 0,
        memoryAvg: 0,
        memoryMax: 0,
        memoryMaxValue: 0
      }
    }

    const cpuValues = data.map(d => d.cpuPercent ?? 0).filter(v => v > 0)
    const memoryValues = data.map(d => d.memoryPercent ?? 0).filter(v => v > 0)
    
    // 找到最大值对应的实际使用量
    const cpuMaxIndex = data.findIndex(d => (d.cpuPercent ?? 0) === Math.max(...cpuValues))
    const memoryMaxIndex = data.findIndex(d => (d.memoryPercent ?? 0) === Math.max(...memoryValues))

    return {
      cpuAvg: cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0,
      cpuMax: cpuValues.length > 0 ? Math.max(...cpuValues) : 0,
      cpuMaxValue: cpuMaxIndex >= 0 ? data[cpuMaxIndex].cpuUsed : 0,
      memoryAvg: memoryValues.length > 0 ? memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length : 0,
      memoryMax: memoryValues.length > 0 ? Math.max(...memoryValues) : 0,
      memoryMaxValue: memoryMaxIndex >= 0 ? data[memoryMaxIndex].memoryUsed : 0
    }
  }, [data])

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
          暂无历史数据，正在收集中...
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* 统计信息 */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
          {showCpu && (
            <div className="space-y-1">
              <div className="text-gray-600">CPU 使用</div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">平均:</span>
                <span className="font-medium text-blue-600">{stats.cpuAvg.toFixed(1)}%</span>
                <span className="text-gray-500">峰值:</span>
                <span className="font-medium text-blue-600">
                  {stats.cpuMax.toFixed(1)}% ({formatCpu(stats.cpuMaxValue)})
                </span>
              </div>
            </div>
          )}
          {showMemory && (
            <div className="space-y-1">
              <div className="text-gray-600">内存使用</div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">平均:</span>
                <span className="font-medium text-green-600">{stats.memoryAvg.toFixed(1)}%</span>
                <span className="text-gray-500">峰值:</span>
                <span className="font-medium text-green-600">
                  {stats.memoryMax.toFixed(1)}% ({formatMemory(stats.memoryMaxValue)})
                </span>
              </div>
            </div>
          )}
        </div>
        
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#6b7280' }}
            />
            <YAxis 
              domain={[0, 100]}
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tick={{ fill: '#6b7280' }}
              label={{ value: '使用率 (%)', angle: -90, position: 'insideLeft', style: { fontSize: '12px', fill: '#6b7280' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ fontSize: '12px' }}
              iconType="line"
            />
            {showCpu && (
              <Line 
                type="monotone" 
                dataKey="cpuPercent" 
                name="CPU" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {showMemory && (
              <Line 
                type="monotone" 
                dataKey="memoryPercent" 
                name="内存" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        
        {/* 数据点数量提示 */}
        <div className="text-xs text-gray-500 text-center mt-2">
          显示最近 {data.length} 个数据点
          {data.length > 0 && ` (${formatTime(data[0].timestamp)} - ${formatTime(data[data.length - 1].timestamp)})`}
        </div>
      </CardContent>
    </Card>
  )
}
