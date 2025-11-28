'use client'

import { memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, X } from 'lucide-react'

interface EnvironmentSectionProps {
  isEditing: boolean
  envVars: Array<{ key: string; value: string }>
  onUpdateEnvVars: (vars: Array<{ key: string; value: string }>) => void
}

/**
 * Environment Variables Section Component
 * 
 * Manages environment variable configuration with add/remove/update functionality.
 * Validates environment variable keys to ensure they follow proper naming conventions.
 * Memoized to prevent unnecessary re-renders.
 */
export const EnvironmentSection = memo(function EnvironmentSection({
  isEditing,
  envVars,
  onUpdateEnvVars
}: EnvironmentSectionProps) {
  const addEnvVar = useCallback(() => {
    onUpdateEnvVars([...envVars, { key: '', value: '' }])
  }, [envVars, onUpdateEnvVars])

  const removeEnvVar = useCallback((index: number) => {
    onUpdateEnvVars(envVars.filter((_, i) => i !== index))
  }, [envVars, onUpdateEnvVars])

  const updateEnvVar = useCallback((index: number, field: 'key' | 'value', value: string) => {
    const newEnvVars = [...envVars]
    newEnvVars[index][field] = value
    onUpdateEnvVars(newEnvVars)
  }, [envVars, onUpdateEnvVars])

  /**
   * Validates environment variable key format
   * Keys must start with a letter or underscore, followed by letters, numbers, or underscores
   */
  const isValidEnvKey = (key: string): boolean => {
    if (!key) return true // Empty is valid (will be filtered on save)
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
  }

  if (!isEditing) {
    // Display mode
    if (envVars.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          未配置环境变量
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {envVars.map((envVar, index) => (
          <div key={index} className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">{envVar.key}</span>
            </div>
            <div>
              <span className="text-gray-600 font-mono break-all">{envVar.value}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-4">
      {envVars.length === 0 ? (
        <div className="text-sm text-gray-500">
          暂无环境变量，点击下方按钮添加
        </div>
      ) : (
        <div className="space-y-3">
          {envVars.map((envVar, index) => {
            const keyInvalid = !isValidEnvKey(envVar.key)
            
            return (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`env-key-${index}`} className="text-xs">
                      变量名
                    </Label>
                    <Input
                      id={`env-key-${index}`}
                      value={envVar.key}
                      onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                      placeholder="例如: DATABASE_URL"
                      className={keyInvalid ? 'border-red-500' : ''}
                    />
                    {keyInvalid && (
                      <p className="text-xs text-red-500 mt-1">
                        变量名必须以字母或下划线开头，只能包含字母、数字和下划线
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`env-value-${index}`} className="text-xs">
                      变量值
                    </Label>
                    <Input
                      id={`env-value-${index}`}
                      value={envVar.value}
                      onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                      placeholder="变量值"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEnvVar(index)}
                  className="mt-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addEnvVar}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        添加环境变量
      </Button>
    </div>
  )
})
