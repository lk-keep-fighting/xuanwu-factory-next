'use client'

import { memo, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, Globe, AlertCircle, ExternalLink } from 'lucide-react'
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
  serviceName?: string
  k8sServiceInfo?: {
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
    clusterIP?: string
    ports?: Array<{
      name?: string
      port: number
      targetPort: number | string
      protocol: 'TCP' | 'UDP'
      nodePort?: number
    }>
    externalIPs?: string[]
    loadBalancerIP?: string
    loadBalancerIngress?: Array<{
      ip?: string
      hostname?: string
    }>
  } | null
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
  serviceName,
  k8sServiceInfo,
  onUpdateServiceType,
  onUpdatePorts,
  onUpdateHeadlessService
}: NetworkSectionProps) {
  const addPort = useCallback(() => {
    onUpdatePorts([
      ...ports,
      {
        id: generatePortId(),
        containerPort: '8080',
        servicePort: '8080',
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

  const updatePort = useCallback((id: string, updates: Partial<NetworkPortFormState>) => {
    const newPorts = ports.map(port => {
      if (port.id === id) {
        const updatedPort = { ...port, ...updates }
        
        // 如果更新了容器端口，且服务端口为空，则自动设置服务端口等于容器端口
        if (updates.containerPort !== undefined && !port.servicePort.trim()) {
          updatedPort.servicePort = updatedPort.containerPort
        }
        
        return updatedPort
      }
      return port
    })
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
   * Generate full URL for domain access
   */
  const generateDomainUrl = (prefix: string): string => {
    const domainName = generateDomainName(prefix)
    return domainName ? `http://${domainName}` : ''
  }

  /**
   * Handle domain link click
   */
  const handleDomainClick = useCallback((prefix: string) => {
    const url = generateDomainUrl(prefix)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }, [project, domainRoot])

  /**
   * Clickable domain link component
   */
  const DomainLink = useCallback(({ 
    prefix, 
    className = "text-sm font-mono text-blue-600 break-all",
    showIcon = true 
  }: { 
    prefix: string
    className?: string
    showIcon?: boolean 
  }) => {
    const domainName = generateDomainName(prefix)
    if (!domainName) return null

    return (
      <button
        onClick={() => handleDomainClick(prefix)}
        className={`${className} hover:text-blue-800 hover:underline cursor-pointer inline-flex items-center gap-1 transition-colors`}
        title={`点击访问 ${domainName}`}
      >
        <span>{domainName}</span>
        {showIcon && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
      </button>
    )
  }, [generateDomainName, handleDomainClick])

  /**
   * Generate default domain prefix based on service name
   */
  const generateDefaultDomainPrefix = (): string => {
    if (!serviceName) {
      return ''
    }
    // Convert service name to valid domain prefix
    return sanitizeDomainLabelInput(serviceName)
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

        {/* Access Information */}
        {k8sServiceInfo && (
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">访问信息</span>
            </div>
            <div className="space-y-2 text-sm">
              {k8sServiceInfo.clusterIP && (
                <div>
                  <span className="text-xs text-blue-600 block mb-1">集群内部 IP</span>
                  <span className="font-mono text-blue-800">{k8sServiceInfo.clusterIP}</span>
                </div>
              )}
              {k8sServiceInfo.type === 'NodePort' && k8sServiceInfo.ports && (
                <div>
                  <span className="text-xs text-blue-600 block mb-1">外部访问端口</span>
                  <div className="space-y-1">
                    {k8sServiceInfo.ports.map((port, index) => (
                      port.nodePort && (
                        <div key={index} className="flex items-center gap-2">
                          <span className="font-mono text-blue-800">
                            {port.nodePort} → {port.port} ({port.protocol})
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            可访问
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
              {k8sServiceInfo.type === 'LoadBalancer' && k8sServiceInfo.loadBalancerIngress && (
                <div>
                  <span className="text-xs text-blue-600 block mb-1">负载均衡器</span>
                  <div className="space-y-1">
                    {k8sServiceInfo.loadBalancerIngress.map((ingress, index) => (
                      <span key={index} className="font-mono text-blue-800 block">
                        {ingress.ip || ingress.hostname}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
            {ports.map((port, index) => {
              // 从k8s服务信息中查找对应的NodePort
              const k8sPort = k8sServiceInfo?.ports?.find(
                k8sP => k8sP.port === parseInt(port.servicePort) && k8sP.protocol === port.protocol
              )
              const actualNodePort = k8sPort?.nodePort || port.nodePort
              
              return (
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
                    {(actualNodePort || serviceType === 'NodePort') && (
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">NodePort</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700">
                            {actualNodePort || '未分配'}
                          </span>
                          {actualNodePort && serviceType === 'NodePort' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                              已分配
                            </span>
                          )}
                        </div>
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
                      <DomainLink prefix={port.domainPrefix} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-4">
      {/* Service Type and Headless Service in same row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              const servicePortInvalid = port.servicePort.trim() && !validatePortNumber(port.servicePort)
              const nodePortInvalid = !validateNodePort(port.nodePort)
              const domainPrefixInvalid = port.enableDomain && !isValidDomainPrefix(port.domainPrefix)

              return (
                <div key={port.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-3">
                      {/* Container Port and Service Port */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`port-container-${port.id}`} className="text-xs">
                            容器端口 *
                          </Label>
                          <Input
                            id={`port-container-${port.id}`}
                            type="number"
                            value={port.containerPort}
                            onChange={(e) => updatePort(port.id, { containerPort: e.target.value })}
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
                          <Label htmlFor={`port-service-${port.id}`} className="text-xs">
                            服务端口
                          </Label>
                          <Input
                            id={`port-service-${port.id}`}
                            type="number"
                            value={port.servicePort}
                            onChange={(e) => updatePort(port.id, { servicePort: e.target.value })}
                            placeholder={port.containerPort || "默认等于容器端口"}
                            className={servicePortInvalid ? 'border-red-500' : ''}
                          />
                          {servicePortInvalid && (
                            <p className="text-xs text-red-500 mt-1">
                              端口号必须在 1-65535 之间
                            </p>
                          )}
                          {!port.servicePort && port.containerPort && (
                            <p className="text-xs text-gray-500 mt-1">
                              留空将使用容器端口 {port.containerPort}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Protocol and NodePort */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`port-protocol-${port.id}`} className="text-xs">
                            协议
                          </Label>
                          <Select
                            value={port.protocol}
                            onValueChange={(value) => updatePort(port.id, { protocol: value as 'TCP' | 'UDP' })}
                          >
                            <SelectTrigger id={`port-protocol-${port.id}`}>
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
                            <Label htmlFor={`port-nodeport-${port.id}`} className="text-xs">
                              NodePort（可选）
                            </Label>
                            <Input
                              id={`port-nodeport-${port.id}`}
                              type="number"
                              value={port.nodePort}
                              onChange={(e) => updatePort(port.id, { nodePort: e.target.value })}
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
                            id={`port-domain-enable-${port.id}`}
                            checked={port.enableDomain}
                            onChange={(e) => {
                              const enabled = e.target.checked
                              const updates: Partial<NetworkPortFormState> = { enableDomain: enabled }
                              
                              // 如果启用域名访问且当前没有域名前缀，则设置默认前缀为服务名
                              if (enabled && !port.domainPrefix) {
                                const defaultPrefix = generateDefaultDomainPrefix()
                                if (defaultPrefix) {
                                  updates.domainPrefix = defaultPrefix
                                }
                              }
                              
                              updatePort(port.id, updates)
                            }}
                            className="rounded"
                          />
                          <Label htmlFor={`port-domain-enable-${port.id}`} className="text-xs cursor-pointer">
                            启用域名访问
                          </Label>
                        </div>

                        {port.enableDomain && (
                          <div>
                            <Label htmlFor={`port-domain-prefix-${port.id}`} className="text-xs">
                              域名前缀 *
                            </Label>
                            <Input
                              id={`port-domain-prefix-${port.id}`}
                              value={port.domainPrefix}
                              onChange={(e) => {
                                const sanitized = sanitizeDomainLabelInput(e.target.value)
                                updatePort(port.id, { domainPrefix: sanitized })
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
                                  <DomainLink 
                                    prefix={port.domainPrefix} 
                                    className="text-xs font-mono text-blue-700 break-all"
                                  />
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
