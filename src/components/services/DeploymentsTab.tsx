'use client'

import { memo, useCallback, useMemo } from 'react'
import { RefreshCw, Rocket, Clock, CheckCircle, XCircle, AlertCircle, Box, GitBranch, Calendar, Timer, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime, formatDuration } from '@/lib/date-utils'
import { DEPLOYMENT_STATUS_META, IMAGE_STATUS_META } from '@/lib/service-constants'
import { ServiceType } from '@/types/project'
import type { DeploymentsTabProps } from '@/types/service-tabs'

/**
 * CurrentDeploymentStatus - Shows the current active deployment
 * Memoized to prevent unnecessary re-renders
 */
const CurrentDeploymentStatus = memo(function CurrentDeploymentStatus({
  currentDeployment,
  ongoingDeployment
}: {
  currentDeployment: DeploymentsTabProps['currentDeployment']
  ongoingDeployment: DeploymentsTabProps['ongoingDeployment']
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">当前部署状态</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ongoingDeployment && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3" role="status" aria-live="polite">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600 animate-pulse" aria-hidden="true" />
                <span className="text-sm font-medium text-blue-900">部署进行中</span>
              </div>
              <div className="text-xs text-blue-700 font-mono">
                {ongoingDeployment.display}
              </div>
              {ongoingDeployment.record?.metadata && 
               typeof ongoingDeployment.record.metadata === 'object' && 
               'branch' in ongoingDeployment.record.metadata && (
                <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  <span>分支: {String(ongoingDeployment.record.metadata.branch)}</span>
                </div>
              )}
            </div>
          )}
          
          {currentDeployment ? (
            <div role="status">
              <div className="text-xs text-gray-600 mb-2">当前运行版本</div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                <span className="text-sm font-mono">{currentDeployment.display}</span>
              </div>
              {currentDeployment.record?.metadata && 
               typeof currentDeployment.record.metadata === 'object' && 
               'branch' in currentDeployment.record.metadata && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  <span>分支: {String(currentDeployment.record.metadata.branch)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center py-2">
              暂无运行中的部署
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

/**
 * DeploymentHistory - Shows paginated deployment history
 * Memoized to prevent unnecessary re-renders
 */
const DeploymentHistory = memo(function DeploymentHistory({
  deployments,
  deploymentsLoading,
  deploymentsError,
  onRefresh
}: {
  deployments: DeploymentsTabProps['deployments']
  deploymentsLoading: boolean
  deploymentsError: string | null
  onRefresh: () => Promise<void>
}) {
  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus === 'success') {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    if (normalizedStatus === 'failed') {
      return <XCircle className="h-4 w-4 text-red-600" />
    }
    if (normalizedStatus === 'building' || normalizedStatus === 'pending') {
      return <Clock className="h-4 w-4 text-blue-600" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-600" />
  }

  const getStatusBadge = (status: string) => {
    const meta = DEPLOYMENT_STATUS_META[status.toLowerCase() as keyof typeof DEPLOYMENT_STATUS_META]
    if (!meta) {
      return <Badge variant="secondary">{status}</Badge>
    }
    return <Badge className={meta.className}>{meta.label}</Badge>
  }

  const calculateDuration = (deployment: DeploymentsTabProps['deployments'][0]) => {
    if (!deployment.created_at) return null
    
    return formatDuration(deployment.created_at, deployment.completed_at || new Date().toISOString())
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">部署历史</CardTitle>
          <CardDescription className="text-xs">
            最近的部署记录
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={deploymentsLoading}
          aria-label="刷新部署历史"
        >
          <RefreshCw className={`h-4 w-4 ${deploymentsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent>
        {deploymentsError ? (
          <div className="flex items-start gap-2 text-sm text-red-600" role="alert" aria-live="polite">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{deploymentsError}</span>
          </div>
        ) : deployments.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            暂无部署记录
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {deployments.map((deployment) => {
              const duration = calculateDuration(deployment)
              const branch = deployment.service_image?.metadata && 
                           typeof deployment.service_image.metadata === 'object' &&
                           'branch' in deployment.service_image.metadata
                ? String(deployment.service_image.metadata.branch)
                : null

              return (
                <div 
                  key={deployment.id} 
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(deployment.status)}
                      {getStatusBadge(deployment.status)}
                    </div>
                    {deployment.created_at && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateTime(deployment.created_at)}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-sm font-mono text-gray-900">
                      {deployment.image_tag || deployment.service_image?.full_image || '未知镜像'}
                    </div>
                    
                    {branch && (
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        <span>{branch}</span>
                      </div>
                    )}
                    
                    {duration && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        <span>耗时: {duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
})

/**
 * BuildHistory - Shows build history for Application services
 * Memoized to prevent unnecessary re-renders
 */
const BuildHistory = memo(function BuildHistory({
  serviceImages,
  imagesLoading,
  imagesError,
  imagePagination,
  currentDeployment,
  onRefresh,
  onPageChange,
  onBuild,
  onDeploy
}: {
  serviceImages: DeploymentsTabProps['serviceImages']
  imagesLoading: boolean
  imagesError: string | null
  imagePagination: DeploymentsTabProps['imagePagination']
  currentDeployment: DeploymentsTabProps['currentDeployment']
  onRefresh: () => Promise<void>
  onPageChange: (page: number) => void
  onBuild: (branch: string, tag: string) => Promise<void>
  onDeploy: (imageId?: string) => Promise<void>
}) {
  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus === 'success') {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    if (normalizedStatus === 'failed') {
      return <XCircle className="h-4 w-4 text-red-600" />
    }
    if (normalizedStatus === 'building') {
      return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
    }
    return <Clock className="h-4 w-4 text-gray-600" />
  }

  const getStatusBadge = (status: string) => {
    const meta = IMAGE_STATUS_META[status.toLowerCase() as keyof typeof IMAGE_STATUS_META]
    if (!meta) {
      return <Badge variant="secondary">{status}</Badge>
    }
    return <Badge className={meta.badgeClass}>{meta.label}</Badge>
  }

  // Extract Jenkins build URL from metadata
  const getJenkinsBuildUrl = (image: DeploymentsTabProps['serviceImages'][0]): string | null => {
    if (!image.metadata || typeof image.metadata !== 'object') {
      return null
    }
    const buildUrl = (image.metadata as Record<string, unknown>).buildUrl
    return typeof buildUrl === 'string' ? buildUrl : null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium">构建历史</CardTitle>
          <CardDescription className="text-xs">
            镜像构建记录
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={imagesLoading}
          aria-label="刷新构建历史"
        >
          <RefreshCw className={`h-4 w-4 ${imagesLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent>
        {imagesError ? (
          <div className="flex items-start gap-2 text-sm text-red-600" role="alert" aria-live="polite">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{imagesError}</span>
          </div>
        ) : serviceImages.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            暂无构建记录
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
              {serviceImages.map((image) => {
                const branch = image.metadata && 
                             typeof image.metadata === 'object' &&
                             'branch' in image.metadata
                  ? String(image.metadata.branch)
                  : null
                
                const jenkinsBuildUrl = getJenkinsBuildUrl(image)
                const isSuccess = image.build_status.toLowerCase() === 'success'
                const canDeploy = isSuccess && image.id
                
                // 判断是否是当前部署使用的镜像
                const isCurrentlyDeployed = Boolean(
                  currentDeployment && (
                    (currentDeployment.id && image.id === currentDeployment.id) ||
                    (currentDeployment.fullImage && image.full_image === currentDeployment.fullImage)
                  )
                )

                return (
                  <div 
                    key={image.id} 
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusIcon(image.build_status)}
                        {getStatusBadge(image.build_status)}
                        {isCurrentlyDeployed && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                            当前部署
                          </Badge>
                        )}
                        {image.is_active && !isCurrentlyDeployed && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                            最新构建
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {image.build_number && (
                          <div className="text-xs text-gray-500">
                            #{image.build_number}
                          </div>
                        )}
                        {jenkinsBuildUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => window.open(jenkinsBuildUrl, '_blank')}
                            title="查看 Jenkins 构建任务"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Jenkins
                          </Button>
                        )}
                        {canDeploy && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-6 px-2 text-xs gap-1"
                            onClick={() => onDeploy(image.id)}
                            title="部署此镜像"
                          >
                            <Rocket className="h-3 w-3" />
                            部署
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="text-sm font-mono text-gray-900">
                        {image.full_image || `${image.image}:${image.tag}`}
                      </div>
                      
                      {branch && (
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          <span>{branch}</span>
                        </div>
                      )}
                      
                      {image.created_at && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(image.created_at)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Pagination */}
            {imagePagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t">
                <div className="text-xs text-gray-600">
                  第 {imagePagination.page} / {imagePagination.totalPages} 页
                  {imagePagination.total > 0 && ` (共 ${imagePagination.total} 条)`}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(imagePagination.page - 1)}
                    disabled={!imagePagination.hasPrevious || imagesLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(imagePagination.page + 1)}
                    disabled={!imagePagination.hasNext || imagesLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
})



/**
 * DeploymentsTab - Main component for deployments, builds, and image management
 * Memoized to prevent unnecessary re-renders when parent re-renders
 */
export const DeploymentsTab = memo(function DeploymentsTab({
  service,
  deployments,
  deploymentsLoading,
  deploymentsError,
  serviceImages,
  imagesLoading,
  imagesError,
  imagePagination,
  currentDeployment,
  ongoingDeployment,
  onRefreshDeployments,
  onRefreshImages,
  onDeploy,
  onBuild,
  onActivateImage,
  onPageChange
}: DeploymentsTabProps) {
  const isApplicationService = service.type === ServiceType.APPLICATION

  return (
    <div className="space-y-6" role="region" aria-label="部署管理">
      {/* Current Deployment Status */}
      <div role="region" aria-label="当前部署状态">
        <CurrentDeploymentStatus
          currentDeployment={currentDeployment}
          ongoingDeployment={ongoingDeployment}
        />
      </div>

      {/* Deployment History */}
      <div role="region" aria-label="部署历史">
        <DeploymentHistory
          deployments={deployments}
          deploymentsLoading={deploymentsLoading}
          deploymentsError={deploymentsError}
          onRefresh={onRefreshDeployments}
        />
      </div>

      {/* Build History - Only for Application services */}
      {isApplicationService && (
        <div role="region" aria-label="构建历史">
          <BuildHistory
            serviceImages={serviceImages}
            imagesLoading={imagesLoading}
            imagesError={imagesError}
            imagePagination={imagePagination}
            currentDeployment={currentDeployment}
            onRefresh={onRefreshImages}
            onPageChange={onPageChange}
            onBuild={onBuild}
            onDeploy={onDeploy}
          />
        </div>
      )}
    </div>
  )
})
