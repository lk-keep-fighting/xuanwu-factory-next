'use client'

import { useState, useEffect, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, AlertCircle } from 'lucide-react'
import { parseResourceValue, combineResourceValue } from '@/lib/resource-utils'

interface ResourcesSectionProps {
  isEditing: boolean
  cpuValue: string
  cpuUnit: 'm' | 'core'
  memoryValue: string
  memoryUnit: 'Mi' | 'Gi'
  cpuRequestValue: string
  cpuRequestUnit: 'm' | 'core'
  memoryRequestValue: string
  memoryRequestUnit: 'Mi' | 'Gi'
  onUpdateResources: (
    limits: { cpu?: string; memory?: string },
    requests: { cpu?: string; memory?: string }
  ) => void
}

export function ResourcesSection({
  isEditing,
  cpuValue,
  cpuUnit,
  memoryValue,
  memoryUnit,
  cpuRequestValue,
  cpuRequestUnit,
  memoryRequestValue,
  memoryRequestUnit,
  onUpdateResources
}: ResourcesSectionProps) {
  // Local state for form inputs
  const [localCpuValue, setLocalCpuValue] = useState(cpuValue)
  const [localCpuUnit, setLocalCpuUnit] = useState<'m' | 'core'>(cpuUnit)
  const [localMemoryValue, setLocalMemoryValue] = useState(memoryValue)
  const [localMemoryUnit, setLocalMemoryUnit] = useState<'Mi' | 'Gi'>(memoryUnit)
  
  const [localCpuRequestValue, setLocalCpuRequestValue] = useState(cpuRequestValue)
  const [localCpuRequestUnit, setLocalCpuRequestUnit] = useState<'m' | 'core'>(cpuRequestUnit)
  const [localMemoryRequestValue, setLocalMemoryRequestValue] = useState(memoryRequestValue)
  const [localMemoryRequestUnit, setLocalMemoryRequestUnit] = useState<'Mi' | 'Gi'>(memoryRequestUnit)

  // Sync local state with props when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalCpuValue(cpuValue)
      setLocalCpuUnit(cpuUnit)
      setLocalMemoryValue(memoryValue)
      setLocalMemoryUnit(memoryUnit)
      setLocalCpuRequestValue(cpuRequestValue)
      setLocalCpuRequestUnit(cpuRequestUnit)
      setLocalMemoryRequestValue(memoryRequestValue)
      setLocalMemoryRequestUnit(memoryRequestUnit)
    }
  }, [isEditing, cpuValue, cpuUnit, memoryValue, memoryUnit, cpuRequestValue, cpuRequestUnit, memoryRequestValue, memoryRequestUnit])

  // Update parent when local state changes (only in edit mode)
  useEffect(() => {
    if (isEditing) {
      const limits = {
        cpu: localCpuValue ? combineResourceValue(localCpuValue, localCpuUnit) : undefined,
        memory: localMemoryValue ? combineResourceValue(localMemoryValue, localMemoryUnit) : undefined
      }
      const requests = {
        cpu: localCpuRequestValue ? combineResourceValue(localCpuRequestValue, localCpuRequestUnit) : undefined,
        memory: localMemoryRequestValue ? combineResourceValue(localMemoryRequestValue, localMemoryRequestUnit) : undefined
      }
      onUpdateResources(limits, requests)
    }
  }, [
    isEditing,
    localCpuValue,
    localCpuUnit,
    localMemoryValue,
    localMemoryUnit,
    localCpuRequestValue,
    localCpuRequestUnit,
    localMemoryRequestValue,
    localMemoryRequestUnit,
    onUpdateResources
  ])

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate CPU limit
    if (localCpuValue) {
      const cpuNum = parseFloat(localCpuValue)
      if (isNaN(cpuNum) || cpuNum <= 0) {
        errors.push('CPU 限制必须是正数')
      } else if (localCpuUnit === 'm' && cpuNum < 10) {
        warnings.push('CPU 限制过低（< 10m），可能导致服务无法正常运行')
      } else if (localCpuUnit === 'core' && cpuNum < 0.01) {
        warnings.push('CPU 限制过低（< 0.01 core），可能导致服务无法正常运行')
      }
    }

    // Validate memory limit
    if (localMemoryValue) {
      const memNum = parseFloat(localMemoryValue)
      if (isNaN(memNum) || memNum <= 0) {
        errors.push('内存限制必须是正数')
      } else if (localMemoryUnit === 'Mi' && memNum < 64) {
        warnings.push('内存限制过低（< 64Mi），可能导致服务无法正常运行')
      } else if (localMemoryUnit === 'Gi' && memNum < 0.064) {
        warnings.push('内存限制过低（< 0.064Gi），可能导致服务无法正常运行')
      }
    }

    // Validate CPU request
    if (localCpuRequestValue) {
      const cpuReqNum = parseFloat(localCpuRequestValue)
      if (isNaN(cpuReqNum) || cpuReqNum <= 0) {
        errors.push('CPU 请求必须是正数')
      }
      
      // Check if request > limit
      if (localCpuValue) {
        const cpuLimitNum = parseFloat(localCpuValue)
        const cpuLimitInM = localCpuUnit === 'core' ? cpuLimitNum * 1000 : cpuLimitNum
        const cpuReqInM = localCpuRequestUnit === 'core' ? cpuReqNum * 1000 : cpuReqNum
        
        if (cpuReqInM > cpuLimitInM) {
          errors.push('CPU 请求不能大于 CPU 限制')
        }
      }
    }

    // Validate memory request
    if (localMemoryRequestValue) {
      const memReqNum = parseFloat(localMemoryRequestValue)
      if (isNaN(memReqNum) || memReqNum <= 0) {
        errors.push('内存请求必须是正数')
      }
      
      // Check if request > limit
      if (localMemoryValue) {
        const memLimitNum = parseFloat(localMemoryValue)
        const memLimitInMi = localMemoryUnit === 'Gi' ? memLimitNum * 1024 : memLimitNum
        const memReqInMi = localMemoryRequestUnit === 'Gi' ? memReqNum * 1024 : memReqNum
        
        if (memReqInMi > memLimitInMi) {
          errors.push('内存请求不能大于内存限制')
        }
      }
    }

    return { errors, warnings, valid: errors.length === 0 }
  }, [
    localCpuValue,
    localCpuUnit,
    localMemoryValue,
    localMemoryUnit,
    localCpuRequestValue,
    localCpuRequestUnit,
    localMemoryRequestValue,
    localMemoryRequestUnit
  ])

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-900">
          <div className="space-y-2">
            <p className="font-medium">资源配置说明</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>限制（Limits）</strong>：容器可以使用的最大资源量，超过限制会被限流或终止</li>
              <li>• <strong>请求（Requests）</strong>：容器启动时保证分配的资源量，用于调度决策</li>
              <li>• 请求值应小于或等于限制值</li>
              <li>• 留空表示不设置限制或请求</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Validation Errors */}
      {validation.errors.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium text-red-900">配置错误：</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Warnings */}
      {validation.warnings.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium text-yellow-900">配置警告：</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Resource Limits */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">资源限制（Limits）</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU Limit */}
            <div className="space-y-2">
              <Label htmlFor="cpu-limit">CPU 限制</Label>
              <div className="flex gap-2">
                <Input
                  id="cpu-limit"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="例如：500"
                  value={localCpuValue}
                  onChange={(e) => setLocalCpuValue(e.target.value)}
                  disabled={!isEditing}
                  className="flex-1"
                />
                <Select
                  value={localCpuUnit}
                  onValueChange={(value) => setLocalCpuUnit(value as 'm' | 'core')}
                  disabled={!isEditing}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">m (毫核)</SelectItem>
                    <SelectItem value="core">core (核)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                1 core = 1000m，建议值：100m - 2000m
              </p>
            </div>

            {/* Memory Limit */}
            <div className="space-y-2">
              <Label htmlFor="memory-limit">内存限制</Label>
              <div className="flex gap-2">
                <Input
                  id="memory-limit"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="例如：512"
                  value={localMemoryValue}
                  onChange={(e) => setLocalMemoryValue(e.target.value)}
                  disabled={!isEditing}
                  className="flex-1"
                />
                <Select
                  value={localMemoryUnit}
                  onValueChange={(value) => setLocalMemoryUnit(value as 'Mi' | 'Gi')}
                  disabled={!isEditing}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mi">Mi</SelectItem>
                    <SelectItem value="Gi">Gi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                1 Gi = 1024 Mi，建议值：128Mi - 2Gi
              </p>
            </div>
          </div>
        </div>

        {/* Resource Requests */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">资源请求（Requests）</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU Request */}
            <div className="space-y-2">
              <Label htmlFor="cpu-request">CPU 请求</Label>
              <div className="flex gap-2">
                <Input
                  id="cpu-request"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="例如：100"
                  value={localCpuRequestValue}
                  onChange={(e) => setLocalCpuRequestValue(e.target.value)}
                  disabled={!isEditing}
                  className="flex-1"
                />
                <Select
                  value={localCpuRequestUnit}
                  onValueChange={(value) => setLocalCpuRequestUnit(value as 'm' | 'core')}
                  disabled={!isEditing}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="m">m (毫核)</SelectItem>
                    <SelectItem value="core">core (核)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                保证分配的 CPU 资源，建议值：50m - 1000m
              </p>
            </div>

            {/* Memory Request */}
            <div className="space-y-2">
              <Label htmlFor="memory-request">内存请求</Label>
              <div className="flex gap-2">
                <Input
                  id="memory-request"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="例如：256"
                  value={localMemoryRequestValue}
                  onChange={(e) => setLocalMemoryRequestValue(e.target.value)}
                  disabled={!isEditing}
                  className="flex-1"
                />
                <Select
                  value={localMemoryRequestUnit}
                  onValueChange={(value) => setLocalMemoryRequestUnit(value as 'Mi' | 'Gi')}
                  disabled={!isEditing}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mi">Mi</SelectItem>
                    <SelectItem value="Gi">Gi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-gray-500">
                保证分配的内存资源，建议值：64Mi - 1Gi
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Common Presets */}
      {isEditing && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">快速预设</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setLocalCpuValue('100')
                setLocalCpuUnit('m')
                setLocalMemoryValue('128')
                setLocalMemoryUnit('Mi')
                setLocalCpuRequestValue('50')
                setLocalCpuRequestUnit('m')
                setLocalMemoryRequestValue('64')
                setLocalMemoryRequestUnit('Mi')
              }}
              className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-sm text-gray-900">小型服务</div>
              <div className="text-xs text-gray-500 mt-1">
                CPU: 100m / 50m<br />
                内存: 128Mi / 64Mi
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setLocalCpuValue('500')
                setLocalCpuUnit('m')
                setLocalMemoryValue('512')
                setLocalMemoryUnit('Mi')
                setLocalCpuRequestValue('250')
                setLocalCpuRequestUnit('m')
                setLocalMemoryRequestValue('256')
                setLocalMemoryRequestUnit('Mi')
              }}
              className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-sm text-gray-900">中型服务</div>
              <div className="text-xs text-gray-500 mt-1">
                CPU: 500m / 250m<br />
                内存: 512Mi / 256Mi
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setLocalCpuValue('2')
                setLocalCpuUnit('core')
                setLocalMemoryValue('2')
                setLocalMemoryUnit('Gi')
                setLocalCpuRequestValue('1')
                setLocalCpuRequestUnit('core')
                setLocalMemoryRequestValue('1')
                setLocalMemoryRequestUnit('Gi')
              }}
              className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <div className="font-medium text-sm text-gray-900">大型服务</div>
              <div className="text-xs text-gray-500 mt-1">
                CPU: 2 core / 1 core<br />
                内存: 2Gi / 1Gi
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
