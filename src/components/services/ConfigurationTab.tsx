'use client'

import { memo, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import type { ConfigurationTabProps } from '@/types/service-tabs'
import { GeneralSection } from './configuration/GeneralSection'
import { EnvironmentSection } from './configuration/EnvironmentSection'
import { VolumesSection } from './configuration/VolumesSection'
import { NetworkSection } from './configuration/NetworkSection'
import { DatabaseConfigSection } from './configuration/DatabaseConfigSection'
import { ServiceType, DatabaseType, type DatabaseService } from '@/types/project'

/**
 * Configuration Tab Component
 * 
 * Consolidates all configuration settings into logical sections:
 * - General Settings (service-type specific)
 * - Environment Variables
 * - Volume Mounts
 * - Network Configuration
 * - Resource Limits
 * 
 * Implements consistent edit/save/cancel pattern across all sections.
 * Memoized to prevent unnecessary re-renders.
 */
export const ConfigurationTab = memo(function ConfigurationTab(props: ConfigurationTabProps) {
  const {
    service,
    project,
    isEditing,
    editedService,
    envVars,
    volumes,
    networkServiceType,
    networkPorts,
    headlessServiceEnabled,
    hasPendingNetworkDeploy,
    onStartEdit,
    onSave,
    onCancel,
    onUpdateService,
    onUpdateEnvVars,
    onUpdateVolumes,
    onUpdateNetwork
  } = props

  // Extract service image for volume template detection - memoized
  const serviceImage = useMemo(() => {
    if (service.type === 'image') {
      return (service as any).image
    }
    if (service.type === 'application') {
      return (service as any).built_image
    }
    return undefined
  }, [service.type, service])

  // Domain root - should be fetched from system config, using default for now
  const domainRoot = 'dev.aimstek.cn' // TODO: Fetch from system config

  // Memoize network update handlers to prevent unnecessary re-renders
  const handleUpdateServiceType = useCallback((type: any) => {
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

  const handleUpdatePorts = useCallback((ports: any) => {
    onUpdateNetwork({
      serviceType: networkServiceType,
      ports: ports.map((p: any) => ({
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
    <div className="space-y-6" role="region" aria-label="服务配置">
      {/* Header with Edit/Save/Cancel buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">服务配置</h2>
          <p className="text-sm text-gray-500 mt-1">
            管理服务的所有配置选项
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={onStartEdit} variant="outline" className="gap-2" aria-label="编辑配置">
            编辑配置
          </Button>
        ) : (
          <div className="flex gap-2" role="group" aria-label="配置编辑操作">
            <Button onClick={onSave} className="gap-2" aria-label="保存配置">
              <Save className="w-4 h-4" aria-hidden="true" />
              保存
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

      {/* General Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>基础配置</CardTitle>
        </CardHeader>
        <CardContent role="region" aria-label="基础配置">
          <GeneralSection
            service={service}
            project={project}
            isEditing={isEditing}
            editedService={editedService}
            onUpdateService={onUpdateService}
          />
        </CardContent>
      </Card>

      {/* Environment Variables Section */}
      <Card>
        <CardHeader>
          <CardTitle>环境变量</CardTitle>
        </CardHeader>
        <CardContent role="region" aria-label="环境变量">
          <EnvironmentSection
            isEditing={isEditing}
            envVars={envVars}
            onUpdateEnvVars={onUpdateEnvVars}
          />
        </CardContent>
      </Card>

      {/* Volumes Section */}
      <Card>
        <CardHeader>
          <CardTitle>卷挂载</CardTitle>
        </CardHeader>
        <CardContent role="region" aria-label="卷挂载">
          <VolumesSection
            isEditing={isEditing}
            volumes={volumes}
            serviceName={service.name}
            serviceImage={serviceImage}
            onUpdateVolumes={onUpdateVolumes}
          />
        </CardContent>
      </Card>

      {/* Network Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle>网络配置</CardTitle>
        </CardHeader>
        <CardContent role="region" aria-label="网络配置">
          <NetworkSection
            isEditing={isEditing}
            serviceType={networkServiceType}
            ports={networkPorts}
            headlessServiceEnabled={headlessServiceEnabled}
            project={project}
            domainRoot={domainRoot}
            onUpdateServiceType={handleUpdateServiceType}
            onUpdatePorts={handleUpdatePorts}
            onUpdateHeadlessService={handleUpdateHeadlessService}
          />
        </CardContent>
      </Card>

      {/* Database Configuration Section - Only for MySQL databases */}
      {service.type === ServiceType.DATABASE && 
       (service as any).database_type === DatabaseType.MYSQL && (
        <Card>
          <CardHeader>
            <CardTitle>数据库配置</CardTitle>
          </CardHeader>
          <CardContent role="region" aria-label="数据库配置">
            <DatabaseConfigSection
              service={service as unknown as DatabaseService}
              onUpdate={() => {
                // Trigger a refresh of the service data
                window.location.reload()
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Resources Section - Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>资源限制</CardTitle>
        </CardHeader>
        <CardContent role="region" aria-label="资源限制">
          <p className="text-sm text-gray-500">资源限制配置将在后续任务中实现</p>
        </CardContent>
      </Card>
    </div>
  )
})
