'use client'

import { memo, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, Globe, AlertCircle } from 'lucide-react'
import { 
  generatePortId, 
  isValidPortNumber, 
  isValidNodePort, 
  isValidDomainPrefix,
  sanitizeDomainLabelInput 
} from '@/lib/network-port-utils'
import type { NetworkPortFormState, ServiceNetworkType } from '@/types/service-tabs'
import type { Project } from '@/types/project'

interface NetworkSectionProps {
  isEditing: boolean
  serviceType: ServiceNetworkType
  ports: NetworkPortFormState[]
  headlessServiceEnabled: boolean
  project: Project | null
  domainRoot: string
  onUpdateServiceType: (type: ServiceNetworkType) => void
  onUpdatePorts: (ports: NetworkPortFormState[]) => void
  onUpdateHeadlessService: (enabled: boolean) => void
}

/**
 * Network Configuration Section Component
 * 
 * Manages network configuration including:
 * - Service type (ClusterIP, NodePort, LoadBalancer)
 * - Port mappings with protocol selection
 * - Domain configuration with prefix input (debounced)
 * - Headless Service toggle for StatefulSet usage
 * 
 * Memoized to prevent unnecessary re-renders.
 */
export const NetworkSection = memo(function NetworkSection({
  isEditing,
  serviceType,
  ports,
  headlessServiceEnabled,
  project,
  domainRoot,
  onUpdateServiceType,
  onUpdatePorts,
  onUpdateHeadlessService
}: NetworkSectionProps) {
  const addPort = useCallback(() => {
    onUpdatePorts([
      ...ports,
      {
        id: generatePortId(),
        containerPort: '',
        servicePort: '',
        protocol: 'TCP',
        nodePort: '',
        enableDomain: false,
        domainPrefix: ''
      }
    ])
  }, [ports, onUpdatePorts])

  const removePort = useCallback((index: number) => {
    onUpdatePorts(ports.filter((_, i) => i !== index))
  }, [ports, onUpdatePorts])

  const updatePort = useCallback((index: number, updates: Partial<NetworkPortFormState>) => {
    const newPorts = [...ports]
    newPorts[index] = { ...newPorts[index], ...updates }
    onUpdatePorts(newPorts)
  }, [ports, onUpdatePorts])

  /**
   * Generate domain name following the pattern: {prefix}.{project-identifier}.{domain-root}
   */
  const generateDomainName = (prefix: string): string => {
    if (!project || !prefix) {
      return ''
    }
    const sanitizedPrefix = sanitizeDomainLabelInput(prefix)
    return `${sanitizedPrefix}.${project.identifier}.${domainRoot}`
  }

  /**
   * Validate port number
   */
  const validatePortNumber = (value: string): boolean => {
    if (!value) return true // Empty is valid (will be filtered on save)
    const num = parseInt(value, 10)
    return !isNaN(num) && isValidPortNumber(num)
  }

  /**
   * Validate NodePort number
   */
  const validateNodePort = (value: string): boolean => {
    if (!value) return true // Empty is valid for optional NodePort
    const num = parseInt(value, 10)
    return !isNaN(num) && isValidNodePort(num)
  }

  if (!isEditing) {
    // Display mode
    return (
      <div className="space-y-4">
        {/* Service Type */}
        <div>
          <span className="text-xs text-gray-500 block mb-1">服务类型</span>
          <span className="font-medium text-gray-700">{serviceType}</span>
        </div>

        {/* Headless Service */}
        {headlessServiceEnabled && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
              Headless Service 已启用
            </span>
          </div>
        )}

        {/* Ports */}
        {ports.length === 0 ? (
          <div className="text-sm text-gray-500">
            未配置端口映射
          </div>
        ) : (
          <div className="space-y-3">
            <span className="text-xs text-gray-500 block">端口映射</span>
            {ports.map((port, index) => (
              <div key={port.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">容器端口</span>
                    <span className="font-medium text-gray-700">{port.containerPort || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">服务端口</span>
                    <span className="font-medium text-gray-700">{port.servicePort || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block mb-1">协议</span>
                    <span className="font-medium text-gray-700">{port.protocol}</span>
                  </div>
                  {port.nodePort && (
                    <div>
                      <span className="text-xs text-gray-500 block mb-1">NodePort</span>
                      <span className="font-medium text-gray-700">{port.nodePort}</span>
                    </div>
                  )}
                </div>
                
                {/* Domain Configuration */}
                {port.enableDomain && port.domainPrefix && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-gray-500">域名访问</span>
                    </div>
                    <span className="text-sm font-mono text-blue-600 break-all">
                      {generateDomainName(port.domainPrefix)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-4">
      {/* Service Type Selector */}
      <div>
        <Label htmlFor="service-type" className="text-xs">
          服务类型
        </Label>
        <Select
          value={serviceType}
          onValueChange={(value) => onUpdateServiceType(value as ServiceNetworkType)}
        >
          <SelectTrigger id="service-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ClusterIP">ClusterIP（集群内部访问）</SelectItem>
            <SelectItem value="NodePort">NodePort（节点端口访问）</SelectItem>
            <SelectItem value="LoadBalancer">LoadBalancer（负载均衡器）</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          {serviceType === 'ClusterIP' && '仅集群内部可访问'}
          {serviceType === 'NodePort' && '通过节点 IP 和端口访问'}
          {serviceType === 'LoadBalancer' && '通过云提供商的负载均衡器访问'}
        </p>
      </div>

      {/* Headless Service Toggle */}
      <div>
        <Label htmlFor="headless-service" className="text-xs">
          Headless Service
        </Label>
        <Select
          value={headlessServiceEnabled ? 'true' : 'false'}
          onValueChange={(value) => onUpdateHeadlessService(value === 'true')}
        >
          <SelectTrigger id="headless-service">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">禁用</SelectItem>
            <SelectItem value="true">启用</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          启用 Headless Service 用于 StatefulSet 或需要直接访问 Pod 的场景
        </p>
      </div>

      {/* Port Mappings */}
      <div className="space-y-3">
        <Label className="text-xs">端口映射</Label>
        
        {ports.length === 0 ? (
          <div className="text-sm text-gray-500">
            暂无端口映射，点击下方按钮添加
          </div>
        ) : (
          <div className="space-y-3">
            {ports.map((port, index) => {
              const containerPortInvalid = !validatePortNumber(port.containerPort)
              const servicePortInvalid = !validatePortNumber(port.servicePort)
              const nodePortInvalid = !validateNodePort(port.nodePort)
              const domainPrefixInvalid = port.enableDomain && !isValidDomainPrefix(port.domainPrefix)

              return (
                <div key={port.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-3">
                      {/* Container Port and Service Port */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`port-container-${index}`} className="text-xs">
                            容器端口 *
                          </Label>
                          <Input
                            id={`port-container-${index}`}
                            type="number"
                            value={port.containerPort}
                            onChange={(e) => updatePort(index, { containerPort: e.target.value })}
                            placeholder="8080"
                            className={containerPortInvalid ? 'border-red-500' : ''}
                          />
                          {containerPortInvalid && (
                            <p className="text-xs text-red-500 mt-1">
                              端口号必须在 1-65535 之间
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor={`port-service-${index}`} className="text-xs">
                            服务端口 *
                          </Label>
                          <Input
                            id={`port-service-${index}`}
                            type="number"
                            value={port.servicePort}
                            onChange={(e) => updatePort(index, { servicePort: e.target.value })}
                            placeholder="80"
                            className={servicePortInvalid ? 'border-red-500' : ''}
                          />
                          {servicePortInvalid && (
                            <p className="text-xs text-red-500 mt-1">
                              端口号必须在 1-65535 之间
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Protocol and NodePort */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`port-protocol-${index}`} className="text-xs">
                            协议
                          </Label>
                          <Select
                            value={port.protocol}
                            onValueChange={(value) => updatePort(index, { protocol: value as 'TCP' | 'UDP' })}
                          >
                            <SelectTrigger id={`port-protocol-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TCP">TCP</SelectItem>
                              <SelectItem value="UDP">UDP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {serviceType === 'NodePort' && (
                          <div>
                            <Label htmlFor={`port-nodeport-${index}`} className="text-xs">
                              NodePort（可选）
                            </Label>
                            <Input
                              id={`port-nodeport-${index}`}
                              type="number"
                              value={port.nodePort}
                              onChange={(e) => updatePort(index, { nodePort: e.target.value })}
                              placeholder="30000-32767"
                              className={nodePortInvalid ? 'border-red-500' : ''}
                            />
                            {nodePortInvalid && (
                              <p className="text-xs text-red-500 mt-1">
                                NodePort 必须在 30000-32767 之间
                              </p>
                            )}
                            {!port.nodePort && (
                              <p className="text-xs text-gray-500 mt-1">
                                留空将自动分配
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Domain Configuration */}
                      <div className="border-t pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            id={`port-domain-enable-${index}`}
                            checked={port.enableDomain}
                            onChange={(e) => updatePort(index, { enableDomain: e.target.checked })}
                            className="rounded"
                          />
                          <Label htmlFor={`port-domain-enable-${index}`} className="text-xs cursor-pointer">
                            启用域名访问
                          </Label>
                        </div>

                        {port.enableDomain && (
                          <div>
                            <Label htmlFor={`port-domain-prefix-${index}`} className="text-xs">
                              域名前缀 *
                            </Label>
                            <Input
                              id={`port-domain-prefix-${index}`}
                              value={port.domainPrefix}
                              onChange={(e) => {
                                const sanitized = sanitizeDomainLabelInput(e.target.value)
                                updatePort(index, { domainPrefix: sanitized })
                              }}
                              placeholder="api"
                              className={domainPrefixInvalid ? 'border-red-500' : ''}
                            />
                            {domainPrefixInvalid && (
                              <p className="text-xs text-red-500 mt-1">
                                域名前缀必须以字母或数字开头和结尾，只能包含小写字母、数字和连字符
                              </p>
                            )}
                            {port.domainPrefix && !domainPrefixInvalid && (
                              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <span className="text-xs font-mono text-blue-700 break-all">
                                    {generateDomainName(port.domainPrefix)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePort(index)}
                      className="flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add Port Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPort}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          添加端口映射
        </Button>
      </div>

      {/* Warning about network changes */}
      <div className="border-l-4 border-amber-500 bg-amber-50 p-3 rounded">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-medium">网络配置更改需要重新部署</p>
            <p className="mt-1">
              保存网络配置的更改后，需要重新部署服务才能使更改生效。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})
