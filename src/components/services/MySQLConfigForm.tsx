'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Info } from 'lucide-react'
import { MYSQL_CONFIG_TEMPLATES, type MySQLConfig } from '@/lib/mysql-config-templates'
import type { MySQLConfigTemplate } from '@/lib/mysql-config-templates'

interface MySQLConfigFormProps {
  value: MySQLConfig
  onChange: (config: MySQLConfig) => void
  disabled?: boolean
  showInitWarning?: boolean
  isDeployed?: boolean
}

/**
 * 获取表名大小写配置的显示标签
 */
function getTableNameCaseLabel(value?: 0 | 1 | 2): string {
  switch (value) {
    case 0:
      return '0 - 区分大小写（Linux 默认）'
    case 1:
      return '1 - 不区分大小写（Windows 兼容）'
    case 2:
      return '2 - 存储小写，比较不区分'
    default:
      return '未设置'
  }
}

export function MySQLConfigForm({ 
  value, 
  onChange, 
  disabled = false,
  showInitWarning = true,
  isDeployed = false
}: MySQLConfigFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('case-insensitive')
  const [showCustomConfig, setShowCustomConfig] = useState(false)

  useEffect(() => {
    if (value.custom_config) {
      setShowCustomConfig(true)
      setSelectedTemplate('custom')
    } else if (value.lower_case_table_names === 1) {
      setSelectedTemplate('case-insensitive')
    } else if (value.lower_case_table_names === 0) {
      setSelectedTemplate('default')
    }
  }, [value.custom_config, value.lower_case_table_names])

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey)
    const template = MYSQL_CONFIG_TEMPLATES[templateKey]
    if (template) {
      onChange(template.config)
      setShowCustomConfig(templateKey === 'custom')
    }
  }

  const handleFieldChange = (field: keyof MySQLConfig, fieldValue: string | number) => {
    onChange({
      ...value,
      [field]: fieldValue
    })
  }

  const currentTemplate = MYSQL_CONFIG_TEMPLATES[selectedTemplate] as MySQLConfigTemplate | undefined

  return (
    <div className="space-y-4">
      {/* 配置模板选择 */}
      <div className="space-y-2">
        <Label>配置模板</Label>
        <Select 
          value={selectedTemplate} 
          onValueChange={handleTemplateChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择预设模板" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MYSQL_CONFIG_TEMPLATES).map(([key, template]) => (
              <SelectItem key={key} value={key}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentTemplate && (
          <p className="text-xs text-gray-500">{currentTemplate.description}</p>
        )}
      </div>

      {/* 模板警告 */}
      {currentTemplate?.warnings && currentTemplate.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 space-y-1">
              {currentTemplate.warnings.map((warning, index) => (
                <div key={index}>• {warning}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* 部署后不可修改的警告 */}
      {isDeployed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <strong>配置限制：</strong>
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5">lower_case_table_names</code>
              等初始化配置已锁定，无法修改。其他配置修改后需要重启服务才能生效。
            </div>
          </div>
        </div>
      )}

      {/* 自定义配置 */}
      {showCustomConfig ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="custom_config">自定义配置（my.cnf）</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowCustomConfig(false)
                setSelectedTemplate('default')
                onChange(MYSQL_CONFIG_TEMPLATES.default.config)
              }}
              disabled={disabled}
            >
              使用表单配置
            </Button>
          </div>
          <Textarea
            id="custom_config"
            value={value.custom_config || ''}
            onChange={(e) => handleFieldChange('custom_config', e.target.value)}
            placeholder="[mysqld]
lower_case_table_names=1
max_connections=200
innodb_buffer_pool_size=256M"
            rows={15}
            className="font-mono text-sm"
            disabled={disabled}
          />
          <p className="text-xs text-gray-500">
            直接编辑 my.cnf 配置文件内容，将覆盖下方的表单配置项
          </p>
        </div>
      ) : (
        <>
          {/* 表单配置 */}
          <div className="space-y-4">
            {/* 表名大小写 */}
            <div className="space-y-2">
              <Label htmlFor="lower_case_table_names">
                表名大小写
                <span className="ml-1 text-xs text-red-500">*初始化配置</span>
              </Label>
              {isDeployed ? (
                <div className="rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900">
                  {getTableNameCaseLabel(value.lower_case_table_names)}
                </div>
              ) : (
                <Select
                  value={value.lower_case_table_names?.toString() || '0'}
                  onValueChange={(v) => handleFieldChange('lower_case_table_names', parseInt(v) as 0 | 1 | 2)}
                  disabled={disabled}
                >
                  <SelectTrigger id="lower_case_table_names">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - 区分大小写（Linux 默认）</SelectItem>
                    <SelectItem value="1">1 - 不区分大小写（Windows 兼容）</SelectItem>
                    <SelectItem value="2">2 - 存储小写，比较不区分</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-500">
                {isDeployed ? (
                  <span className="text-amber-600">🔒 此配置已锁定，无法修改</span>
                ) : (
                  <span>⚠️ 此配置必须在初始化前设置，部署后无法修改</span>
                )}
              </p>
            </div>

            {/* 字符集 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="character_set_server">字符集</Label>
                <Select
                  value={value.character_set_server || 'utf8mb4'}
                  onValueChange={(v) => handleFieldChange('character_set_server', v)}
                  disabled={disabled}
                >
                  <SelectTrigger id="character_set_server">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utf8mb4">utf8mb4（推荐）</SelectItem>
                    <SelectItem value="utf8">utf8</SelectItem>
                    <SelectItem value="latin1">latin1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="collation_server">排序规则</Label>
                <Select
                  value={value.collation_server || 'utf8mb4_unicode_ci'}
                  onValueChange={(v) => handleFieldChange('collation_server', v)}
                  disabled={disabled}
                >
                  <SelectTrigger id="collation_server">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</SelectItem>
                    <SelectItem value="utf8mb4_general_ci">utf8mb4_general_ci</SelectItem>
                    <SelectItem value="utf8mb4_bin">utf8mb4_bin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 连接配置 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_connections">最大连接数</Label>
                <Input
                  id="max_connections"
                  type="number"
                  value={value.max_connections || 151}
                  onChange={(e) => handleFieldChange('max_connections', parseInt(e.target.value))}
                  placeholder="151"
                  min={1}
                  max={10000}
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thread_cache_size">线程缓存大小</Label>
                <Input
                  id="thread_cache_size"
                  type="number"
                  value={value.thread_cache_size || ''}
                  onChange={(e) => handleFieldChange('thread_cache_size', parseInt(e.target.value))}
                  placeholder="8"
                  min={0}
                  max={1000}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* InnoDB 配置 */}
            <div className="space-y-2">
              <Label htmlFor="innodb_buffer_pool_size">InnoDB 缓冲池大小</Label>
              <Input
                id="innodb_buffer_pool_size"
                value={value.innodb_buffer_pool_size || '128M'}
                onChange={(e) => handleFieldChange('innodb_buffer_pool_size', e.target.value)}
                placeholder="128M"
                disabled={disabled}
              />
              <p className="text-xs text-gray-500">
                例如：128M、1G、2048M
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="innodb_log_file_size">InnoDB 日志文件大小</Label>
                <Input
                  id="innodb_log_file_size"
                  value={value.innodb_log_file_size || ''}
                  onChange={(e) => handleFieldChange('innodb_log_file_size', e.target.value)}
                  placeholder="48M"
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="innodb_flush_log_at_trx_commit">事务提交刷新</Label>
                <Select
                  value={value.innodb_flush_log_at_trx_commit?.toString() || '1'}
                  onValueChange={(v) => handleFieldChange('innodb_flush_log_at_trx_commit', parseInt(v) as 0 | 1 | 2)}
                  disabled={disabled}
                >
                  <SelectTrigger id="innodb_flush_log_at_trx_commit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - 每秒刷新（性能最高）</SelectItem>
                    <SelectItem value="1">1 - 每次提交刷新（最安全）</SelectItem>
                    <SelectItem value="2">2 - 每次提交写入（折中）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 切换到自定义配置 */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCustomConfig(true)
                  setSelectedTemplate('custom')
                }}
                disabled={disabled}
              >
                切换到自定义配置
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
