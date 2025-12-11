'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  File as FileIcon,
  Folder,
  Loader2,
  RefreshCw,
  UploadCloud
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { serviceSvc } from '@/service/serviceSvc'
import type { K8sFileEntry } from '@/types/k8s'
import { cn } from '@/lib/utils'
import { FileEditDialog } from './FileEditDialog'

type ServiceFileManagerProps = {
  serviceId?: string
  active?: boolean
}

type DirectoryTreeNode = {
  name: string
  path: string
  isRoot?: boolean
}

const ROOT_NODE: DirectoryTreeNode = { name: '/', path: '/', isRoot: true }

const normalizeDirectoryPath = (rawPath?: string | null) => {
  if (!rawPath) {
    return '/'
  }
  let value = rawPath.trim()
  if (!value) {
    return '/'
  }
  value = value.replace(/\\/g, '/')
  if (!value.startsWith('/')) {
    value = `/${value}`
  }
  value = value.replace(/\/+/g, '/')
  if (value.length > 1 && value.endsWith('/')) {
    value = value.replace(/\/+$/, '')
  }
  return value || '/'
}

export function ServiceFileManager({ serviceId, active = true }: ServiceFileManagerProps) {
  const [entries, setEntries] = useState<K8sFileEntry[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pathInputValue, setPathInputValue] = useState('/')
  const [directoryCache, setDirectoryCache] = useState<Record<string, K8sFileEntry[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({ '/': true })
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedFileForEdit, setSelectedFileForEdit] = useState<K8sFileEntry | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentPathRef = useRef('/')
  const pendingPathRef = useRef<string | null>(null)
  const inflightRequests = useRef<Set<string>>(new Set())

  const resetState = useCallback(() => {
    setEntries([])
    setCurrentPath('/')
    setParentPath(null)
    setHasInitialized(false)
    setError(null)
    setPathInputValue('/')
    setDirectoryCache({})
    setExpandedPaths({ '/': true })
    setEditDialogOpen(false)
    setSelectedFileForEdit(null)
    currentPathRef.current = '/'
    pendingPathRef.current = null
    inflightRequests.current.clear()
  }, [])

  useEffect(() => {
    resetState()
  }, [serviceId, resetState])

  const loadDirectory = useCallback(
    async (targetPath: string) => {
      if (!serviceId) {
        return null
      }
      const normalizedTarget = normalizeDirectoryPath(targetPath)
      
      // Prevent concurrent requests to same path
      if (inflightRequests.current.has(normalizedTarget)) {
        return null
      }
      
      inflightRequests.current.add(normalizedTarget)
      
      try {
        const data = await serviceSvc.listServiceFiles(serviceId, normalizedTarget)
        const normalizedPath = normalizeDirectoryPath(data.path)
        const normalizedParent =
          data.parentPath === null ? null : normalizeDirectoryPath(data.parentPath)
        const rawEntries = Array.isArray(data.entries) ? data.entries : []
        const normalizedEntries = rawEntries.map((entry) => {
          const normalizedEntryPath = normalizeDirectoryPath(entry.path || `${normalizedPath}/${entry.name}`)
          return {
            ...entry,
            path: normalizedEntryPath
          }
        })
        const normalizedData = {
          ...data,
          path: normalizedPath,
          parentPath: normalizedParent,
          entries: normalizedEntries
        }
        // 过滤子目录：只保留直接子目录，排除父路径和自己
        const directoryEntries = normalizedEntries
          .filter((entry) => {
            if (entry.type !== 'directory') return false
            if (entry.path === normalizedPath) return false
            
            // 排除父路径或祖先路径（防止循环引用）
            // 如果 entry.path 是 normalizedPath 的前缀或相等，说明是父/祖先
            if (entry.path.length < normalizedPath.length && 
                normalizedPath.startsWith(entry.path)) {
              return false
            }
            
            // 只保留直接子目录
            if (normalizedPath === '/') {
              // 根目录的直接子目录：/xxx（第二个 / 的位置应该是 -1）
              return entry.path.lastIndexOf('/') === 0
            } else {
              // 其他目录的直接子目录：必须以 "当前路径/" 开头，且后面没有更多 /
              if (!entry.path.startsWith(normalizedPath + '/')) return false
              const suffix = entry.path.substring(normalizedPath.length + 1)
              return suffix.indexOf('/') === -1
            }
          })
        const uniqueDirectoryEntries: K8sFileEntry[] = []
        const seenPaths = new Set<string>()
        for (const entry of directoryEntries) {
          if (seenPaths.has(entry.path)) {
            continue
          }
          seenPaths.add(entry.path)
          uniqueDirectoryEntries.push(entry)
        }
        uniqueDirectoryEntries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        setDirectoryCache(prev => ({ ...prev, [normalizedPath]: uniqueDirectoryEntries }))
        return normalizedData
      } catch (error) {
        throw error
      } finally {
        inflightRequests.current.delete(normalizedTarget)
      }
    },
    [serviceId]
  )

  const loadAndActivateDirectory = useCallback(
    async (targetPath: string) => {
      if (!serviceId || !active) {
        return
      }
      const normalizedTarget = normalizeDirectoryPath(targetPath)
      
      // Check if request is already in flight before setting loading state
      if (inflightRequests.current.has(normalizedTarget)) {
        return
      }
      
      pendingPathRef.current = normalizedTarget
      setLoading(true)
      setError(null)

      try {
        const data = await loadDirectory(normalizedTarget)
        if (!data) {
          return
        }
        currentPathRef.current = data.path
        setEntries(Array.isArray(data.entries) ? data.entries : [])
        setCurrentPath(data.path)
        setParentPath(data.parentPath)
        setPathInputValue(data.path)
        setHasInitialized(true)
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : '加载文件失败'
        setError(message)
        toast.error(`加载文件失败：${message}`)
        setHasInitialized(true)
      } finally {
        pendingPathRef.current = null
        setLoading(false)
      }
    },
    [serviceId, active, loadDirectory]
  )

  useEffect(() => {
    if (active && serviceId && !hasInitialized && !loading) {
      void loadAndActivateDirectory('/')
    }
  }, [active, serviceId, hasInitialized, loading, loadAndActivateDirectory])

  const handleSelectPath = useCallback(
    (target: string) => {
      const normalizedTarget = normalizeDirectoryPath(target)
      if (normalizedTarget === currentPathRef.current) {
        return
      }
      void loadAndActivateDirectory(normalizedTarget)
    },
    [loadAndActivateDirectory]
  )

  const handleDirectoryEntrySelect = useCallback(
    (entry: K8sFileEntry) => {
      if (entry.type !== 'directory') {
        return
      }
      const fallbackPath = entry.path && entry.path.trim().length > 0
        ? entry.path
        : `${currentPathRef.current}/${entry.name}`
      handleSelectPath(fallbackPath)
    },
    [handleSelectPath]
  )

  const handlePathSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!serviceId || !active) {
        return
      }
      const target = pathInputValue.trim() || '/'
      void handleSelectPath(target)
    },
    [serviceId, active, pathInputValue, handleSelectPath]
  )

  const handleParentNavigate = useCallback(() => {
    if (parentPath) {
      handleSelectPath(parentPath)
    }
  }, [parentPath, handleSelectPath])

  const handleRefresh = useCallback(() => {
    if (!serviceId || !active) {
      return
    }
    void loadAndActivateDirectory(currentPathRef.current)
  }, [serviceId, active, loadAndActivateDirectory])

  const handleUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!serviceId || !active) {
        return
      }

      const files = event.target.files
      if (!files || !files.length) {
        return
      }

      const fileArray = Array.from(files)
      const totalFiles = fileArray.length
      
      setUploading(true)
      
      // 显示开始上传的提示
      const uploadingToast = toast.loading(
        totalFiles > 1 
          ? `正在上传 ${totalFiles} 个文件...` 
          : `正在上传 ${fileArray[0]?.name ?? '文件'}...`
      )
      
      try {
        let successCount = 0
        let failedFiles: string[] = []
        
        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i]
          try {
            // 更新进度提示
            if (totalFiles > 1) {
              toast.loading(
                `正在上传 ${file.name} (${i + 1}/${totalFiles})...`,
                { id: uploadingToast }
              )
            }
            
            await serviceSvc.uploadServiceFile(serviceId, currentPathRef.current, file)
            successCount++
          } catch (fileError) {
            failedFiles.push(file.name)
            const errorMessage = fileError instanceof Error ? fileError.message : '未知错误'
            console.error(`上传文件 ${file.name} 失败:`, fileError)
            
            // 如果是第一个文件失败，显示详细错误
            if (failedFiles.length === 1 && totalFiles === 1) {
              toast.dismiss(uploadingToast)
              toast.error(`上传失败：${errorMessage}`, {
                duration: 6000 // 延长显示时间
              })
              setUploading(false)
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
              return
            }
          }
        }
        
        // 关闭加载提示
        toast.dismiss(uploadingToast)
        
        // 显示结果
        if (successCount === totalFiles) {
          toast.success(
            totalFiles > 1 
              ? `成功上传 ${totalFiles} 个文件` 
              : `文件 ${fileArray[0]?.name ?? ''} 上传成功`
          )
        } else if (successCount > 0) {
          toast.warning(
            `成功上传 ${successCount} 个文件，${failedFiles.length} 个失败：${failedFiles.join(', ')}`
          )
        } else {
          toast.error(`所有文件上传失败`)
        }
        
        // 刷新目录列表
        void loadAndActivateDirectory(currentPathRef.current)
      } catch (uploadError) {
        toast.dismiss(uploadingToast)
        const message = uploadError instanceof Error ? uploadError.message : '上传文件失败'
        toast.error(`上传文件失败：${message}`)
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [serviceId, active, loadAndActivateDirectory]
  )

  const handleDownload = useCallback(
    (entry: K8sFileEntry) => {
      if (!serviceId || entry.type === 'directory') {
        return
      }
      const url = serviceSvc.getServiceFileDownloadUrl(serviceId, entry.path)
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    },
    [serviceId]
  )

  const handleEditFile = useCallback(
    (entry: K8sFileEntry) => {
      if (!serviceId || entry.type === 'directory') {
        return
      }
      setSelectedFileForEdit(entry)
      setEditDialogOpen(true)
    },
    [serviceId]
  )

  const handleEditSaveSuccess = useCallback(() => {
    // 文件保存成功后刷新当前目录
    void loadAndActivateDirectory(currentPathRef.current)
  }, [loadAndActivateDirectory])

  const prefetchDirectory = useCallback(
    async (targetPath: string) => {
      if (!serviceId || !active) {
        return
      }
      const normalizedTarget = normalizeDirectoryPath(targetPath)
      
      // 检查当前缓存（使用闭包中的 directoryCache）
      if (directoryCache[normalizedTarget]) {
        return
      }
      
      // 静默加载
      try {
        await loadDirectory(normalizedTarget)
      } catch (prefetchError) {
        // 静默失败
      }
    },
    [serviceId, active, loadDirectory, directoryCache]
  )
  const handleToggleExpand = useCallback(
    (path: string) => {
      const normalizedPath = normalizeDirectoryPath(path)
      const wasExpanded = expandedPaths[normalizedPath]
      const needsPrefetch = !wasExpanded && !directoryCache[normalizedPath]
      
      // 先更新状态
      setExpandedPaths(prev => {
        if (prev[normalizedPath]) {
          // Collapse
          const next = { ...prev }
          delete next[normalizedPath]
          return next
        } else {
          // Expand
          return { ...prev, [normalizedPath]: true }
        }
      })
      
      // 然后在外部加载（只执行一次）
      if (needsPrefetch) {
        void prefetchDirectory(normalizedPath)
      }
    },
    [expandedPaths, directoryCache, prefetchDirectory]
  )

  const breadcrumbItems = useMemo(() => {
    const parts = currentPath === '/' ? [] : currentPath.split('/').filter(Boolean)
    const items = parts.map((part, index) => {
      const fullPath = `/${parts.slice(0, index + 1).join('/')}`
      return { label: part, path: fullPath }
    })
    return [{ label: '/', path: '/' }, ...items]
  }, [currentPath])
  if (!serviceId) {
    return (
      <div className="rounded-lg border bg-white p-6 text-sm text-gray-500">
        服务信息加载完成后可使用文件管理功能。
      </div>
    )
  }

  const pendingPath = pendingPathRef.current
  const treeDisabled = !active

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUploadChange} />
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">容器文件管理</h3>
            <p className="text-sm text-gray-500">浏览、下载或上传服务容器中的文件。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleRefresh}
              disabled={loading || !active}
            >
              <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : undefined)} />
              刷新
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !active}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploading ? '上传中…' : '上传文件'}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-md border bg-gray-50 p-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-900">目录树</p>
              <p className="text-xs text-gray-500">
                {active ? '选择左侧目录，右侧展示对应内容' : '切换到“文件管理”标签可浏览目录'}
              </p>
            </div>
            <div className="mt-3 max-h-[520px] overflow-auto pr-1">
              <DirectoryTreeItem
                node={ROOT_NODE}
                expandedPaths={expandedPaths}
                onToggle={handleToggleExpand}
                onSelect={handleSelectPath}
                directoryCache={directoryCache}
                selectedPath={currentPath}
                pendingPath={pendingPath}
                disabled={treeDisabled}
              />
            </div>
          </div>

          <div className="space-y-4">
            <form onSubmit={handlePathSubmit} className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  value={pathInputValue}
                  onChange={(event) => setPathInputValue(event.target.value)}
                  disabled={loading || !active}
                  placeholder="/"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={loading || !active}>
                  跳转
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleParentNavigate}
                  disabled={!parentPath || loading || !active}
                >
                  <ArrowUp className="h-4 w-4" />
                  上一级
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {breadcrumbItems.map((item, index) => (
                <div key={item.path} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-gray-400">/</span> : null}
                  <button
                    type="button"
                    className={cn(
                      'text-sm font-medium text-blue-600 hover:underline',
                      item.path === currentPath ? 'cursor-default text-gray-900 no-underline' : undefined
                    )}
                    onClick={() => (item.path === currentPath ? undefined : handleSelectPath(item.path))}
                    disabled={item.path === currentPath || loading || !active}
                  >
                    {item.label || '/'}
                  </button>
                </div>
              ))}
            </div>

            {error ? (
              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-2/5">名称</TableHead>
                    <TableHead className="w-1/6">类型</TableHead>
                    <TableHead className="w-1/6 text-right">大小</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !entries.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在加载...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!loading && !entries.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-sm text-gray-500">
                        当前目录下没有可显示的文件。
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {entries.map((entry, index) => {
                    // 格式化文件大小
                    const formatSize = (bytes: number | undefined) => {
                      if (bytes === undefined || bytes === null) return '-'
                      if (bytes === 0) return '0 B'
                      const units = ['B', 'KB', 'MB', 'GB']
                      const k = 1024
                      const i = Math.floor(Math.log(bytes) / Math.log(k))
                      const value = bytes / Math.pow(k, i)
                      const decimals = i === 0 ? 0 : value >= 100 ? 1 : 2
                      return `${value.toFixed(decimals)} ${units[i]}`
                    }

                    return (
                    <TableRow key={`${entry.path || entry.name || 'entry'}-${entry.type}-${index}`}>
                      <TableCell>
                        {entry.type === 'directory' ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left"
                            onClick={() => handleDirectoryEntrySelect(entry)}
                            disabled={!active || loading}
                          >
                            <Folder className="h-4 w-4 text-blue-600" />
                            <span
                              className={cn(
                                'text-sm font-medium text-blue-600 hover:underline',
                                entry.isHidden ? 'text-gray-500' : undefined
                              )}
                            >
                              {entry.name}
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-4 w-4 text-gray-500" />
                            <span
                              className={cn(
                                'text-sm font-medium text-gray-900',
                                entry.isHidden ? 'text-gray-500' : undefined
                              )}
                            >
                              {entry.name}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {entry.type === 'directory' ? '目录' : '文件'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-600 font-mono">
                        {entry.type === 'directory' ? (
                          <span className="text-gray-400">--</span>
                        ) : (
                          formatSize((entry as any).size)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.type === 'directory' ? (
                          <span className="text-xs text-gray-400">--</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1 px-2"
                              onClick={() => handleEditFile(entry)}
                              disabled={!active}
                              title="编辑文件"
                            >
                              <Edit className="h-4 w-4" />
                              编辑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="gap-1 px-2"
                              onClick={() => handleDownload(entry)}
                              disabled={!active}
                              title="下载文件"
                            >
                              <Download className="h-4 w-4" />
                              下载
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* 文件编辑对话框 */}
      <FileEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        serviceId={serviceId || ''}
        file={selectedFileForEdit}
        onSaveSuccess={handleEditSaveSuccess}
      />
    </div>
  )
}

type DirectoryTreeItemProps = {
  node: DirectoryTreeNode
  expandedPaths: Record<string, boolean>
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  directoryCache: Record<string, K8sFileEntry[]>
  selectedPath: string
  pendingPath: string | null
  disabled?: boolean
}

const DirectoryTreeItem = memo(function DirectoryTreeItem({
  node,
  expandedPaths,
  onToggle,
  onSelect,
  directoryCache,
  selectedPath,
  pendingPath,
  disabled
}: DirectoryTreeItemProps) {
  const normalizedPath = normalizeDirectoryPath(node.path)
  const isExpanded = Boolean(expandedPaths[normalizedPath])
  const isSelected = selectedPath === normalizedPath
  const isLoading = pendingPath === normalizedPath
  const childDirectories = directoryCache[normalizedPath] ?? []
  const hasLoaded = Boolean(directoryCache[normalizedPath])
  const showToggle = node.isRoot || isLoading || childDirectories.length > 0 || !hasLoaded

  return (
    <div>
      <div className="flex items-center gap-1">
        {showToggle ? (
          <button
            type="button"
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded text-gray-500 transition hover:bg-gray-200',
              disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : undefined
            )}
            onClick={() => (disabled ? undefined : onToggle(normalizedPath))}
            disabled={disabled}
            aria-label={isExpanded ? '折叠目录' : '展开目录'}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="h-5 w-5" />
        )}

        <button
          type="button"
          onClick={() => onSelect(normalizedPath)}
          disabled={disabled}
          className={cn(
            'flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm transition',
            isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100',
            disabled ? 'cursor-not-allowed opacity-60 hover:bg-transparent' : undefined
          )}
        >
          <Folder className={cn('h-4 w-4', isSelected ? 'text-blue-600' : 'text-gray-500')} />
          <span className="truncate">{node.isRoot ? '/' : node.name}</span>
        </button>
      </div>

      {isExpanded ? (
        <div className="ml-4 space-y-0.5">
          {isLoading || !hasLoaded ? (
            <div className="flex items-center gap-2 py-1 pl-1 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载中...
            </div>
          ) : childDirectories.length ? (
            childDirectories.map((child) => (
              <DirectoryTreeItem
                key={child.path}
                node={{ name: child.name, path: child.path }}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                onSelect={onSelect}
                directoryCache={directoryCache}
                selectedPath={selectedPath}
                pendingPath={pendingPath}
                disabled={disabled}
              />
            ))
          ) : (
            <div className="py-1 pl-1 text-xs text-gray-400">没有子目录</div>
          )}
        </div>
      ) : null}
    </div>
  )
})
