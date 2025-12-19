'use client'

import { useState, memo, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X, HardDrive } from 'lucide-react'
import { findVolumeTemplate, generateNFSSubpath, type ImageVolumeTemplate } from '@/lib/volume-templates'
import type { VolumeMount } from '@/types/service-tabs'

interface VolumesSectionProps {
  isEditing: boolean
  volumes: VolumeMount[]
  serviceName: string
  serviceImage?: string
  onUpdateVolumes: (volumes: VolumeMount[]) => void
}

/**
 * Volumes Section Component
 * 
 * Manages volume mount configuration with add/remove/update functionality.
 * Provides volume template application for common images.
 * Memoized to prevent unnecessary re-renders.
 */
export const VolumesSection = memo(function VolumesSection({
  isEditing,
  volumes,
  serviceName,
  serviceImage,
  onUpdateVolumes
}: VolumesSectionProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ImageVolumeTemplate | null>(null)

  // Find available template based on service image - memoized
  const availableTemplate = useMemo(() => 
    serviceImage ? findVolumeTemplate(serviceImage) : null,
    [serviceImage]
  )

  const addVolume = useCallback(() => {
    onUpdateVolumes([
      ...volumes,
      {
        container_path: '',
        read_only: false
      }
    ])
  }, [volumes, onUpdateVolumes])

  const removeVolume = useCallback((index: number) => {
    onUpdateVolumes(volumes.filter((_, i) => i !== index))
  }, [volumes, onUpdateVolumes])

  const updateVolume = useCallback((index: number, field: keyof VolumeMount, value: string | boolean) => {
    const newVolumes = [...volumes]
    if (field === 'read_only') {
      newVolumes[index][field] = value as boolean
    } else {
      newVolumes[index][field] = value as string
      
      // 如果更新的是容器路径，且当前NFS子路径为空，自动生成默认值
      if (field === 'container_path' && value && !newVolumes[index].nfs_subpath) {
        newVolumes[index].nfs_subpath = generateNFSSubpath(serviceName, value as string)
      }
    }
    onUpdateVolumes(newVolumes)
  }, [volumes, onUpdateVolumes, serviceName])

  const applyTemplate = useCallback((template: ImageVolumeTemplate) => {
    // Convert template volumes to VolumeMount format
    const templateVolumes: VolumeMount[] = template.volumes.map(vol => ({
      container_path: vol.container_path,
      nfs_subpath: generateNFSSubpath(serviceName, vol.container_path),
      read_only: vol.read_only || false
    }))

    // Merge with existing volumes, avoiding duplicates
    const existingPaths = new Set(volumes.map(v => v.container_path))
    const newVolumes = templateVolumes.filter(v => !existingPaths.has(v.container_path))

    onUpdateVolumes([...volumes, ...newVolumes])
    setSelectedTemplate(null)
  }, [serviceName, volumes, onUpdateVolumes])

  /**
   * Validates container path format
   * Paths must be absolute (start with /)
   */
  const isValidContainerPath = (path: string): boolean => {
    if (!path) return true // Empty is valid (will be filtered on save)
    return path.startsWith('/')
  }

  if (!isEditing) {
    // Display mode
    if (volumes.length === 0) {
      return (
        <div className="text-sm text-gray-500">
          未配置卷挂载
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {volumes.map((volume, index) => (
          <div key={index} className="border rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-500 block mb-1">容器路径</span>
                <span className="font-medium text-gray-700 font-mono">{volume.container_path}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block mb-1">NFS 子路径</span>
                <span className="text-gray-600 font-mono text-xs break-all">
                  {volume.nfs_subpath || generateNFSSubpath(serviceName, volume.container_path)}
                </span>
              </div>
            </div>
            {volume.read_only && (
              <div className="mt-2">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700">
                  只读
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-4">
      {/* Template Application */}
      {availableTemplate && (
        <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900">
                检测到 {availableTemplate.displayName} 镜像
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                {availableTemplate.description}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                可以应用推荐的卷挂载配置（{availableTemplate.volumes.length} 个挂载点）
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(availableTemplate)}
                className="mt-3 bg-white hover:bg-blue-50 border-blue-300"
              >
                应用推荐配置
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Volume List */}
      {volumes.length === 0 ? (
        <div className="text-sm text-gray-500">
          暂无卷挂载，点击下方按钮添加
        </div>
      ) : (
        <div className="space-y-3">
          {volumes.map((volume, index) => {
            const pathInvalid = !isValidContainerPath(volume.container_path)
            const autoGeneratedSubpath = generateNFSSubpath(serviceName, volume.container_path)

            return (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-3">
                    {/* Container Path */}
                    <div>
                      <Label htmlFor={`volume-path-${index}`} className="text-xs">
                        容器路径 *
                      </Label>
                      <Input
                        id={`volume-path-${index}`}
                        value={volume.container_path}
                        onChange={(e) => updateVolume(index, 'container_path', e.target.value)}
                        placeholder="/data"
                        className={pathInvalid ? 'border-red-500' : ''}
                      />
                      {pathInvalid && (
                        <p className="text-xs text-red-500 mt-1">
                          容器路径必须以 / 开头
                        </p>
                      )}
                    </div>

                    {/* NFS Subpath */}
                    <div>
                      <Label htmlFor={`volume-subpath-${index}`} className="text-xs">
                        NFS 子路径（可选）
                      </Label>
                      <Input
                        id={`volume-subpath-${index}`}
                        value={volume.nfs_subpath || ''}
                        onChange={(e) => updateVolume(index, 'nfs_subpath', e.target.value)}
                        placeholder={autoGeneratedSubpath}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        留空将自动生成：{autoGeneratedSubpath}
                      </p>
                    </div>

                    {/* Read Only */}
                    <div>
                      <Label htmlFor={`volume-readonly-${index}`} className="text-xs">
                        访问模式
                      </Label>
                      <Select
                        value={volume.read_only ? 'true' : 'false'}
                        onValueChange={(value) => updateVolume(index, 'read_only', value === 'true')}
                      >
                        <SelectTrigger id={`volume-readonly-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">读写</SelectItem>
                          <SelectItem value="true">只读</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVolume(index)}
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

      {/* Add Volume Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addVolume}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        添加卷挂载
      </Button>
    </div>
  )
})
