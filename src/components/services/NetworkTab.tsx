'use client'

import { memo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import { NetworkSection } from './configuration/NetworkSection'
import type { Project } from '@/types/project'
import type { NetworkPortFormState, ServiceNetworkType } from '@/types/service-tabs'

export interface NetworkTabProps {
  isEditing: boolean
  networkServiceType: ServiceNetworkType
  networkPorts: NetworkPortFormState[]
  headlessServiceEnabled: boolean
  project: Project | null
  serviceName?: string
  hasPendingNetworkDeploy: boolean
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
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateNetwork: (config: {
    serviceType: ServiceNetworkType
    ports: Array<{
      containerPort: number
      servicePort: number
      protocol: 'TCP' | 'UDP'
      nodePort?: number
      domain?: {
        enabled: boolean
        prefix: string
        host: string
      }
    }>
    headlessServiceEnabled: boolean
  }) => void
}

/**
 * Network Configuration Tab Component
 * 
 * Dedicated tab for managing network and domain configuration.
 * Provides quick access to frequently edited network settings.
 */
export const NetworkTab = memo(function NetworkTab(props: NetworkTabProps) {
  const {
    isEditing,
    networkServiceType,
    networkPorts,
    headlessServiceEnabled,
    project,
    serviceName,
    hasPendingNetworkDeploy,
    k8sServiceInfo,
    onStartEdit,
    onSave,
    onCancel,
    onUpdateNetwork
  } = props

  // Domain root - should be fetched from system config, using default for now
  const domainRoot = 'dev.aimstek.cn' // TODO: Fetch from system config

  // Memoize network update handlers to prevent unnecessary re-renders
  const handleUpdateServiceType = useCallback((type: ServiceNetworkType) => {
    onUpdateNetwork({
      serviceType: type,
      ports: networkPorts.map(p => ({
        containerPort: parseInt(p.containerPort) || 0,
        servicePort: parseInt(p.servicePort) || 0,
        protocol: p.protocol,
        nodePort: p.nodePort ? parseInt(p.nodePort) : undefined,
        domain: p.enableDomain ? {
          enabled: true,
          prefix: p.domainPrefix,
          host: `${p.domainPrefix}.${project?.identifier}.${domainRoot}`
        } : undefined
      })),
      headlessServiceEnabled
    })
  }, [networkPorts, headlessServiceEnabled, project?.identifier, domainRoot, onUpdateNetwork])

  const handleUpdatePorts = useCallback((ports: NetworkPortFormState[]) => {
    onUpdateNetwork({
      serviceType: networkServiceType,
      ports: ports.map(p => ({
        containerPort: parseInt(p.containerPort) || 0,
        servicePort: parseInt(p.servicePort) || 0,
        protocol: p.protocol,
        nodePort: p.nodePort ? parseInt(p.nodePort) : undefined,
        domain: p.enableDomain ? {
          enabled: true,
          prefix: p.domainPrefix,
          host: `${p.domainPrefix}.${project?.identifier}.${domainRoot}`
        } : undefined
      })),
      headlessServiceEnabled
    })
  }, [networkServiceType, headlessServiceEnabled, project?.identifier, domainRoot, onUpdateNetwork])

  const handleUpdateHeadlessService = useCallback((enabled: boolean) => {
    onUpdateNetwork({
      serviceType: networkServiceType,
      ports: networkPorts.map(p => ({
        containerPort: parseInt(p.containerPort) || 0,
        servicePort: parseInt(p.servicePort) || 0,
        protocol: p.protocol,
        nodePort: p.nodePort ? parseInt(p.nodePort) : undefined,
        domain: p.enableDomain ? {
          enabled: true,
          prefix: p.domainPrefix,
          host: `${p.domainPrefix}.${project?.identifier}.${domainRoot}`
        } : undefined
      })),
      headlessServiceEnabled: enabled
    })
  }, [networkServiceType, networkPorts, project?.identifier, domainRoot, onUpdateNetwork])

  return (
    <div className="space-y-6" role="region" aria-label="网络配置">
      {/* Header with Edit/Save/Cancel buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">网络配置</h2>
          <p className="text-sm text-gray-500 mt-1">
            配置服务的网络访问和域名
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={onStartEdit} variant="outline" className="gap-2" aria-label="编辑网络配置">
            编辑
          </Button>
        ) : (
          <div className="flex gap-2" role="group" aria-label="网络配置编辑操作">
            <Button onClick={onSave} className="gap-2" aria-label="保存网络配置">
              <Save className="w-4 h-4" aria-hidden="true" />
              保存并重启
            </Button>
            <Button onClick={onCancel} variant="outline" className="gap-2" aria-label="取消编辑">
              <X className="w-4 h-4" aria-hidden="true" />
              取消
            </Button>
          </div>
        )}
      </div>

      {/* Pending Network Deploy Warning */}
      {hasPendingNetworkDeploy && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3" role="alert" aria-live="polite">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center" aria-hidden="true">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  网络配置已更新
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  网络配置的更改需要重新部署服务才能生效。请在完成所有配置更改后执行部署操作。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>网络与域名</CardTitle>
          <CardDescription>
            配置服务类型、端口映射和域名访问
          </CardDescription>
        </CardHeader>
        <CardContent role="region" aria-label="网络与域名配置">
          <NetworkSection
            isEditing={isEditing}
            serviceType={networkServiceType}
            ports={networkPorts}
            headlessServiceEnabled={headlessServiceEnabled}
            project={project}
            domainRoot={domainRoot}
            serviceName={serviceName}
            k8sServiceInfo={k8sServiceInfo}
            onUpdateServiceType={handleUpdateServiceType}
            onUpdatePorts={handleUpdatePorts}
            onUpdateHeadlessService={handleUpdateHeadlessService}
          />
        </CardContent>
      </Card>
    </div>
  )
})
