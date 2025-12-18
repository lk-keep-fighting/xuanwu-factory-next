'use client'

import { memo, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import type { ConfigurationTabProps } from '@/types/service-tabs'
import { GeneralSection } from './configuration/GeneralSection'
import { DatabaseConfigSection } from './configuration/DatabaseConfigSection'
import { ResourcesSection } from './configuration/ResourcesSection'
import { ServiceType, DatabaseType, type DatabaseService } from '@/types/project'

/**
 * Configuration Tab Component
 * 
 * Consolidates core configuration settings:
 * - General Settings (service-type specific)
 * - Resource Limits
 * - Database Configuration (for MySQL services)
 * 
 * Note: Environment variables, volume mounts, and network configuration have been moved to dedicated tabs.
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
    cpuValue,
    cpuUnit,
    memoryValue,
    memoryUnit,
    cpuRequestValue,
    cpuRequestUnit,
    memoryRequestValue,
    memoryRequestUnit,
    hasPendingNetworkDeploy,
    onStartEdit,
    onSave,
    onCancel,
    onUpdateService,
    onUpdateEnvVars,
    onUpdateVolumes,
    onUpdateNetwork,
    onUpdateResources
  } = props



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

      {/* Resources Section */}
      <Card>
        <CardHeader>
          <CardTitle>资源限制</CardTitle>
        </CardHeader>
        <CardContent role="region" aria-label="资源限制">
          <ResourcesSection
            isEditing={isEditing}
            cpuValue={cpuValue}
            cpuUnit={cpuUnit}
            memoryValue={memoryValue}
            memoryUnit={memoryUnit}
            cpuRequestValue={cpuRequestValue}
            cpuRequestUnit={cpuRequestUnit}
            memoryRequestValue={memoryRequestValue}
            memoryRequestUnit={memoryRequestUnit}
            onUpdateResources={onUpdateResources}
          />
        </CardContent>
      </Card>
    </div>
  )
})
