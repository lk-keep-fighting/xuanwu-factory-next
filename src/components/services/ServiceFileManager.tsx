'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
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

const buildAncestorPaths = (path: string) => {
  const normalized = normalizeDirectoryPath(path)
  if (normalized === '/') {
    return ['/']
  }
  const segments = normalized.split('/').filter(Boolean)
  const ancestors: string[] = ['/']
  let current = ''
  for (let i = 0; i < segments.length - 1; i += 1) {
    current = `${current}/${segments[i]}`
    ancestors.push(normalizeDirectoryPath(current))
  }
  return ancestors
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
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['/']))
  const [treeLoadingPaths, setTreeLoadingPaths] = useState<Set<string>>(() => new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentPathRef = useRef('/')
  const pendingPathRef = useRef<string | null>(null)

  const resetState = useCallback(() => {
    setEntries([])
    setCurrentPath('/')
    setParentPath(null)
    setHasInitialized(false)
    setError(null)
    setPathInputValue('/')
    setDirectoryCache({})
    setExpandedPaths(new Set(['/']))
    setTreeLoadingPaths(new Set())
    currentPathRef.current = '/'
    pendingPathRef.current = null
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
      const data = await serviceSvc.listServiceFiles(serviceId, normalizedTarget)
      const normalizedPath = normalizeDirectoryPath(data.path)
      const normalizedParent =
        data.parentPath === null ? null : normalizeDirectoryPath(data.parentPath)
      const normalizedData = {
        ...data,
        path: normalizedPath,
        parentPath: normalizedParent
      }
      const directoryEntries = normalizedData.entries
        .filter((entry) => entry.type === 'directory')
        .map((entry) => {
          const normalizedEntryPath = normalizeDirectoryPath(entry.path || `${normalizedPath}/${entry.name}`)
          return {
            ...entry,
            path: normalizedEntryPath
          }
        })
        .filter((entry) => entry.path !== normalizedPath)
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
      setDirectoryCache((prev) => ({
        ...prev,
        [normalizedPath]: uniqueDirectoryEntries
      }))
      return normalizedData
    },
    [serviceId]
  )

  const loadAndActivateDirectory = useCallback(
    async (targetPath: string) => {
      if (!serviceId || !active) {
        return
      }
      const normalizedTarget = normalizeDirectoryPath(targetPath)
      pendingPathRef.current = normalizedTarget
      setLoading(true)
      setError(null)

      try {
        const data = await loadDirectory(normalizedTarget)
        if (!data) {
          return
        }
        currentPathRef.current = data.path
        setEntries(data.entries)
        setCurrentPath(data.path)
        setParentPath(data.parentPath)
        setPathInputValue(data.path)
        setHasInitialized(true)
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          const ancestors = buildAncestorPaths(data.path)
          ancestors.forEach((ancestor) => next.add(ancestor))
          return next
        })
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

      setUploading(true)
      try {
        for (const file of Array.from(files)) {
          await serviceSvc.uploadServiceFile(serviceId, currentPathRef.current, file)
        }
        toast.success(
          files.length > 1 ? `已上传 ${files.length} 个文件` : `文件 ${files[0]?.name ?? ''} 上传成功`
        )
        void loadAndActivateDirectory(currentPathRef.current)
      } catch (uploadError) {
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

  const prefetchDirectory = useCallback(
    async (targetPath: string) => {
      if (!serviceId || !active) {
        return
      }
      const normalizedTarget = normalizeDirectoryPath(targetPath)
      if (directoryCache[normalizedTarget]) {
        return
      }
      setTreeLoadingPaths((prev) => {
        const next = new Set(prev)
        next.add(normalizedTarget)
        return next
      })
      try {
        await loadDirectory(normalizedTarget)
      } catch (prefetchError) {
        const message = prefetchError instanceof Error ? prefetchError.message : '加载目录失败'
        toast.error(`加载目录失败：${message}`)
      } finally {
        setTreeLoadingPaths((prev) => {
          const next = new Set(prev)
          next.delete(normalizedTarget)
          return next
        })
      }
    },
    [serviceId, active, directoryCache, loadDirectory]
  )

  const handleToggleExpand = useCallback(
    (path: string) => {
      const normalizedPath = normalizeDirectoryPath(path)
      const willExpand = !expandedPaths.has(normalizedPath)
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        if (next.has(normalizedPath)) {
          next.delete(normalizedPath)
        } else {
          next.add(normalizedPath)
        }
        return next
      })
      if (willExpand && !directoryCache[normalizedPath]) {
        void prefetchDirectory(normalizedPath)
      }
    },
    [expandedPaths, directoryCache, prefetchDirectory]
  )

  const getDirectoryChildren = useCallback(
    (path: string) => {
      const normalized = normalizeDirectoryPath(path)
      return directoryCache[normalized] ?? []
    },
    [directoryCache]
  )

  const hasLoadedDirectory = useCallback(
    (path: string) => Boolean(directoryCache[normalizeDirectoryPath(path)]),
    [directoryCache]
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
                getChildren={getDirectoryChildren}
                selectedPath={currentPath}
                loadingPaths={treeLoadingPaths}
                pendingPath={pendingPath}
                hasLoadedDirectory={hasLoadedDirectory}
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
                    <TableHead className="w-1/2">名称</TableHead>
                    <TableHead className="w-1/4">类型</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !entries.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-sm text-gray-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          正在加载...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!loading && !entries.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-sm text-gray-500">
                        当前目录下没有可显示的文件。
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {entries.map((entry, index) => (
                    <TableRow key={`${entry.path || entry.name || 'entry'}-${entry.type}-${index}`}>
                      <TableCell>
                        {entry.type === 'directory' ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left"
                            onClick={() => handleSelectPath(entry.path)}
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
                      <TableCell className="text-right">
                        {entry.type === 'directory' ? (
                          <span className="text-xs text-gray-400">--</span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleDownload(entry)}
                            disabled={!active}
                          >
                            <Download className="h-4 w-4" />
                            下载
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type DirectoryTreeItemProps = {
  node: DirectoryTreeNode
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  getChildren: (path: string) => K8sFileEntry[]
  selectedPath: string
  loadingPaths: Set<string>
  pendingPath: string | null
  hasLoadedDirectory: (path: string) => boolean
  disabled?: boolean
}

function DirectoryTreeItem({
  node,
  expandedPaths,
  onToggle,
  onSelect,
  getChildren,
  selectedPath,
  loadingPaths,
  pendingPath,
  hasLoadedDirectory,
  disabled
}: DirectoryTreeItemProps) {
  const normalizedPath = normalizeDirectoryPath(node.path)
  const isExpanded = expandedPaths.has(normalizedPath)
  const isSelected = selectedPath === normalizedPath
  const isLoading = loadingPaths.has(normalizedPath) || pendingPath === normalizedPath
  const childDirectories = getChildren(normalizedPath)
  const hasLoaded = hasLoadedDirectory(normalizedPath)
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
          {isLoading ? (
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
                getChildren={getChildren}
                selectedPath={selectedPath}
                loadingPaths={loadingPaths}
                pendingPath={pendingPath}
                hasLoadedDirectory={hasLoadedDirectory}
                disabled={disabled}
              />
            ))
          ) : hasLoaded ? (
            <div className="py-1 pl-1 text-xs text-gray-400">没有子目录</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
