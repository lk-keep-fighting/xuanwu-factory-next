'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AlertCircle, Info, Save, RotateCw } from 'lucide-react'
import { MySQLConfigForm } from '@/components/services/MySQLConfigForm'
import { toast } from 'sonner'
import type { DatabaseService, MySQLConfig } from '@/types/project'
import { DatabaseType } from '@/types/project'

interface DatabaseConfigSectionProps {
  service: DatabaseService
  onUpdate?: () => void
}

export function DatabaseConfigSection({ service, onUpdate }: DatabaseConfigSectionProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [config, setConfig] = useState<MySQLConfig>(service.mysql_config || {})
  const [loading, setLoading] = useState(false)

  // 判断服务是否已部署
  const isDeployed = service.status === 'running' || 
                     service.status === 'building' ||
                     service.status === 'stopped'

  // 只支持 MySQL
  if (service.database_type !== DatabaseType.MYSQL) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          当前数据库类型（{service.database_type}）暂不支持配置管理
        </p>
      </div>
    )
  }

  const handleSave = async (restart: boolean) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/services/${service.id}/mysql-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mysql_config: config,
          restart
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '更新配置失败')
      }

      if (data.warning) {
        toast.warning(data.warning)
      } else {
        toast.success(restart ? '配置已保存并重启服务' : '配置已保存')
      }

      setIsEditing(false)
      onUpdate?.()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新配置失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setConfig(service.mysql_config || {})
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">MySQL 配置</h3>
          <p className="text-sm text-gray-500">管理 MySQL 数据库的配置参数</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="outline">
            编辑配置
          </Button>
        )}
      </div>

      {/* 配置修改说明 */}
      <div className="space-y-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <strong>配置修改说明：</strong>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                <li>
                  <code className="rounded bg-amber-100 px-1 py-0.5">lower_case_table_names</code>
                  等初始化配置无法修改，需要重建数据库
                </li>
                <li>其他配置修改后需要重启 Pod 才能生效</li>
                <li>修改配置前建议先备份数据</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              配置文件路径：<code className="rounded bg-blue-100 px-1 py-0.5">/etc/mysql/conf.d/my.cnf</code>
            </div>
          </div>
        </div>
      </div>

      {/* 配置表单 */}
      {isEditing ? (
        <div className="space-y-4">
          <MySQLConfigForm
            value={config}
            onChange={setConfig}
            disabled={loading}
            showInitWarning={false}
            isDeployed={isDeployed}
          />

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存并重启
                </>
              )}
            </Button>
            <Button
              onClick={() => handleSave(false)}
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              仅保存
            </Button>
            <Button
              onClick={handleCancel}
              disabled={loading}
              variant="ghost"
            >
              取消
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <ConfigItem
            label="表名大小写"
            value={getTableNameCaseLabel(config.lower_case_table_names)}
            readonly
          />
          <ConfigItem
            label="字符集"
            value={config.character_set_server || 'utf8mb4'}
          />
          <ConfigItem
            label="排序规则"
            value={config.collation_server || 'utf8mb4_unicode_ci'}
          />
          <ConfigItem
            label="最大连接数"
            value={config.max_connections || 151}
          />
          <ConfigItem
            label="InnoDB 缓冲池"
            value={config.innodb_buffer_pool_size || '128M'}
          />
          {config.thread_cache_size && (
            <ConfigItem
              label="线程缓存"
              value={config.thread_cache_size}
            />
          )}
          {config.custom_config && (
            <div className="pt-2">
              <Label className="text-xs text-gray-500">自定义配置</Label>
              <pre className="mt-1 rounded bg-gray-100 p-2 text-xs font-mono overflow-x-auto">
                {config.custom_config}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConfigItem({
  label,
  value,
  readonly = false
}: {
  label: string
  value: string | number
  readonly?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
      <Label className="text-sm font-medium text-gray-700">
        {label}
        {readonly && (
          <span className="ml-2 text-xs text-red-500">（只读）</span>
        )}
      </Label>
      <span className="text-sm text-gray-900 font-mono">{value}</span>
    </div>
  )
}

function getTableNameCaseLabel(value?: 0 | 1 | 2): string {
  switch (value) {
    case 0:
      return '0 - 区分大小写'
    case 1:
      return '1 - 不区分大小写'
    case 2:
      return '2 - 存储小写'
    default:
      return '未设置'
  }
}
