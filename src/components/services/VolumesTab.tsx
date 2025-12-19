'use client'

import { memo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HardDrive, Save, X } from 'lucide-react'
import { VolumesSection } from './configuration/VolumesSection'
import { generateNFSSubpath } from '@/lib/volume-templates'
import type { VolumeMount } from '@/types/service-tabs'

export interface VolumesTabProps {
  isEditing: boolean
  volumes: VolumeMount[]
  serviceName: string
  serviceImage?: string
  onStartEdit: () => void
  onSave: () => Promise<void>
  onCancel: () => void
  onUpdateVolumes: (volumes: VolumeMount[]) => void
}

/**
 * Volumes Tab Component
 * 
 * Dedicated tab for managing volume mount configurations.
 * Separated from the main configuration tab for better organization.
 */
export const VolumesTab = memo(function VolumesTab({
  isEditing,
  volumes,
  serviceName,
  serviceImage,
  onStartEdit,
  onSave,
  onCancel,
  onUpdateVolumes
}: VolumesTabProps) {
  // 处理保存，确保所有空的 nfs_subpath 都被填充
  const handleSave = useCallback(async () => {
    // 自动填充空的 nfs_subpath
    const volumesWithSubpath = volumes.map(volume => ({
      ...volume,
      nfs_subpath: volume.nfs_subpath || generateNFSSubpath(serviceName, volume.container_path)
    }))
    
    // 更新卷挂载配置
    onUpdateVolumes(volumesWithSubpath)
    
    // 调用原始保存函数
    await onSave()
  }, [volumes, serviceName, onUpdateVolumes, onSave])
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            卷挂载配置
          </CardTitle>
          <CardDescription>
            配置服务的数据卷挂载，支持 NFS 存储持久化数据
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                保存
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartEdit}
              className="gap-2"
            >
              <HardDrive className="w-4 h-4" />
              编辑
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <VolumesSection
          isEditing={isEditing}
          volumes={volumes}
          serviceName={serviceName}
          serviceImage={serviceImage}
          onUpdateVolumes={onUpdateVolumes}
        />
      </CardContent>
    </Card>
  )
})