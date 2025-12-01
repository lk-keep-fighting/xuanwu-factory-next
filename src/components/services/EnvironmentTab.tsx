'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'
import { EnvironmentSection } from './configuration/EnvironmentSection'

export interface EnvironmentTabProps {
  isEditing: boolean
  envVars: Array<{ key: string; value: string }>
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateEnvVars: (vars: Array<{ key: string; value: string }>) => void
}

/**
 * Environment Variables Tab Component
 * 
 * Dedicated tab for managing environment variables.
 * Provides quick access to frequently edited configuration.
 */
export const EnvironmentTab = memo(function EnvironmentTab(props: EnvironmentTabProps) {
  const {
    isEditing,
    envVars,
    onStartEdit,
    onSave,
    onCancel,
    onUpdateEnvVars
  } = props

  return (
    <div className="space-y-6" role="region" aria-label="环境变量配置">
      {/* Header with Edit/Save/Cancel buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">环境变量</h2>
          <p className="text-sm text-gray-500 mt-1">
            配置服务运行时的环境变量
          </p>
        </div>
        {!isEditing ? (
          <Button onClick={onStartEdit} variant="outline" className="gap-2" aria-label="编辑环境变量">
            编辑
          </Button>
        ) : (
          <div className="flex gap-2" role="group" aria-label="环境变量编辑操作">
            <Button onClick={onSave} className="gap-2" aria-label="保存环境变量">
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

      {/* Environment Variables Section */}
      <Card>
        <CardHeader>
          <CardTitle>环境变量列表</CardTitle>
          <CardDescription>
            添加或修改环境变量后需要重启服务才能生效
          </CardDescription>
        </CardHeader>
        <CardContent role="region" aria-label="环境变量列表">
          <EnvironmentSection
            isEditing={isEditing}
            envVars={envVars}
            onUpdateEnvVars={onUpdateEnvVars}
          />
        </CardContent>
      </Card>
    </div>
  )
})
