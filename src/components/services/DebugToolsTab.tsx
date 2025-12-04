'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, X, Wrench } from 'lucide-react'
import type { DebugToolsTabProps } from '@/types/service-tabs'
import { DebugToolsSection } from './configuration/DebugToolsSection'

/**
 * Debug Tools Tab Component
 * 
 * Dedicated tab for managing debug tools configuration.
 * Provides a focused interface for enabling and configuring debug tools
 * without cluttering the main configuration tab.
 */
export const DebugToolsTab = memo(function DebugToolsTab(props: DebugToolsTabProps) {
  const {
    service,
    isEditing,
    editedService,
    onStartEdit,
    onSave,
    onCancel,
    onUpdateService
  } = props

  const debugConfig = editedService?.debug_config ?? service.debug_config

  return (
    <div className="space-y-6" role="region" aria-label="调试工具">
      {/* Header with Edit/Save/Cancel buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Wrench className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">调试工具</h2>
            <p className="text-sm text-gray-500 mt-1">
              通过 Init Container 注入调试工具，无需修改主镜像
            </p>
          </div>
        </div>
        {!isEditing ? (
          <Button onClick={onStartEdit} variant="outline" className="gap-2" aria-label="编辑调试工具">
            编辑配置
          </Button>
        ) : (
          <div className="flex gap-2" role="group" aria-label="调试工具编辑操作">
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

      {/* Debug Tools Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>调试工具配置</CardTitle>
          <CardDescription>
            选择并配置需要注入到容器中的调试工具。支持多种常用的调试和诊断工具，如 curl、vim、netcat 等。
          </CardDescription>
        </CardHeader>
        <CardContent role="region" aria-label="调试工具配置">
          <DebugToolsSection
            isEditing={isEditing}
            debugConfig={debugConfig}
            onUpdateDebugConfig={(config) => {
              onUpdateService({ debug_config: config })
            }}
          />
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className="font-medium text-blue-900">💡 使用提示</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>调试工具通过 Init Container 注入，不会修改您的主容器镜像</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>工具安装在共享卷中，所有容器都可以访问</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>修改配置后需要重新部署服务才能生效</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>建议在开发和测试环境使用，生产环境请谨慎启用</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
