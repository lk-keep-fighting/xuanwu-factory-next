'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  
  // Debug: log render with state references
  console.log(`[FileManager] 🔄 Render #${Math.random().toString(36).substr(2, 5)}, directoryCache keys:`, Object.keys(directoryCache), 'expandedPaths:', Array.from(expandedPaths))
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentPathRef = useRef('/')
  const pendingPathRef = useRef<string | null>(null)
  const inflightRequests = useRef<Set<string>>(new Set())
  const directoryCacheRef = useRef<Record<string, K8sFileEntry[]>>({})
  const toggleInProgress = useRef(false)

  const resetState = useCallback(() => {
    setEntries([])
    setCurrentPath('/')
    setParentPath(null)
    setHasInitialized(false)
    setError(null)
    setPathInputValue('/')
    directoryCacheRef.current = {}
    setDirectoryCache({})
    setExpandedPaths(new Set(['/']))
    setTreeLoadingPaths(new Set())
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
      
      console.log(`[FileManager] loadDirectory called for: ${normalizedTarget}`)
      console.log(`[FileManager] Current inflight:`, Array.from(inflightRequests.current))
      
      // Prevent concurrent requests to same path
      if (inflightRequests.current.has(normalizedTarget)) {
        console.warn(`[FileManager] ⚠️ Request already in flight for ${normalizedTarget}`)
        return null
      }
      
      console.log(`[FileManager] ✅ Starting request for ${normalizedTarget}`)
      inflightRequests.current.add(normalizedTarget)
      
      try {
        console.log(`[FileManager] 📡 Fetching ${normalizedTarget}...`)
        const data = await serviceSvc.listServiceFiles(serviceId, normalizedTarget)
        console.log(`[FileManager] ✅ Got response for ${normalizedTarget}:`, data.entries.length, 'entries')
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
        const directoryEntries = normalizedEntries
          .filter((entry) => entry.type === 'directory' && entry.path !== normalizedPath)
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
        const newCache = {
          ...directoryCacheRef.current,
          [normalizedPath]: uniqueDirectoryEntries
        }
        directoryCacheRef.current = newCache
        console.log(`[FileManager] 💾 About to call setDirectoryCache...`)
        setDirectoryCache(newCache)
        console.log(`[FileManager] ✅ setDirectoryCache completed`)
        console.log(`[FileManager] 💾 Cached ${normalizedPath}, total cache size:`, Object.keys(directoryCacheRef.current).length)
        return normalizedData
      } catch (error) {
        console.error(`[FileManager] ❌ Error loading ${normalizedTarget}:`, error)
        throw error
      } finally {
        console.log(`[FileManager] 🔓 Releasing lock for ${normalizedTarget}`)
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
      
      console.log(`[FileManager] 🎯 loadAndActivateDirectory: ${normalizedTarget}`)
      console.log(`[FileManager] Current path: ${currentPathRef.current}`)
      
      // Check if request is already in flight before setting loading state
      if (inflightRequests.current.has(normalizedTarget)) {
        console.warn(`[FileManager] ⚠️ Request already in flight for ${normalizedTarget}, SKIPPING activation`)
        return
      }
      
      pendingPathRef.current = normalizedTarget
      setLoading(true)
      setError(null)

      try {
        console.log(`[FileManager] ⏳ Calling loadDirectory from loadAndActivateDirectory`)
        const data = await loadDirectory(normalizedTarget)
        console.log(`[FileManager] 📦 loadDirectory returned:`, data ? `${data.entries.length} entries for ${data.path}` : 'NULL')
        if (!data) {
          console.error(`[FileManager] ❌ Data is null, aborting UI update`)
          return
        }
        console.log(`[FileManager] 🔄 Updating UI state...`)
        console.log(`[FileManager] Setting currentPathRef to:`, data.path)
        currentPathRef.current = data.path
        console.log(`[FileManager] Setting entries:`, data.entries.length)
        setEntries(Array.isArray(data.entries) ? data.entries : [])
        console.log(`[FileManager] Setting currentPath`)
        setCurrentPath(data.path)
        console.log(`[FileManager] Setting parentPath`)
        setParentPath(data.parentPath)
        console.log(`[FileManager] Setting pathInputValue`)
        setPathInputValue(data.path)
        console.log(`[FileManager] Setting hasInitialized`)
        setHasInitialized(true)
        // Note: We don't update expandedPaths here to avoid render loops
        // The tree will naturally expand when user interacts with it
        console.log(`[FileManager] ✅ UI state update complete`)
      } catch (fetchError) {
        console.error(`[FileManager] ❌ Exception in loadAndActivateDirectory:`, fetchError)
        const message = fetchError instanceof Error ? fetchError.message : '加载文件失败'
        setError(message)
        toast.error(`加载文件失败：${message}`)
        setHasInitialized(true)
      } finally {
        console.log(`[FileManager] 🏁 Finally block: clearing loading state`)
        pendingPathRef.current = null
        setLoading(false)
        // Force a microtask delay to ensure state updates are flushed
        Promise.resolve().then(() => {
          console.log(`[FileManager] ✅ Loading state cleared, should re-render now`)
        })
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
      console.log(`[FileManager] 👆 handleSelectPath called:`, target)
      const normalizedTarget = normalizeDirectoryPath(target)
      console.log(`[FileManager] Normalized to:`, normalizedTarget)
      console.log(`[FileManager] Current path is:`, currentPathRef.current)
      if (normalizedTarget === currentPathRef.current) {
        console.log(`[FileManager] ⏭️ Already at this path, skipping`)
        return
      }
      console.log(`[FileManager] 🚀 Calling loadAndActivateDirectory`)
      void loadAndActivateDirectory(normalizedTarget)
    },
    [loadAndActivateDirectory]
  )

  const handleDirectoryEntrySelect = useCallback(
    (entry: K8sFileEntry) => {
      console.log(`[FileManager] 🖱️ handleDirectoryEntrySelect:`, entry.name, entry.type)
      if (entry.type !== 'directory') {
        console.log(`[FileManager] Not a directory, ignoring`)
        return
      }
      const fallbackPath = entry.path && entry.path.trim().length > 0
        ? entry.path
        : `${currentPathRef.current}/${entry.name}`
      console.log(`[FileManager] Computed path:`, fallbackPath)
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
      if (directoryCacheRef.current[normalizedTarget]) {
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
    [serviceId, active, loadDirectory]
  )

  const handleToggleExpand = useCallback(
    (path: string) => {
      // Prevent duplicate rapid-fire calls
      if (toggleInProgress.current) {
        console.log(`[FileManager] ⚠️ Toggle already in progress, ignoring`)
        return
      }
      
      const normalizedPath = normalizeDirectoryPath(path)
      console.log(`[FileManager] 🔄 handleToggleExpand:`, normalizedPath)
      
      toggleInProgress.current = true
      
      // Read current state directly to avoid double-invoke issues in StrictMode
      const wasExpanded = expandedPaths.has(normalizedPath)
      const willExpand = !wasExpanded
      
      const next = new Set(expandedPaths)
      if (wasExpanded) {
        next.delete(normalizedPath)
        console.log(`[FileManager] Collapsing ${normalizedPath}`)
      } else {
        next.add(normalizedPath)
        console.log(`[FileManager] Expanding ${normalizedPath}`)
      }
      console.log(`[FileManager] 🔴 About to call setExpandedPaths`)
      setExpandedPaths(next)
      console.log(`[FileManager] 🟢 setExpandedPaths completed`)
      
      // Reset flag after state update completes
      setTimeout(() => {
        toggleInProgress.current = false
      }, 100)
      
      // Check after state update to use latest directoryCache
      if (willExpand && !directoryCacheRef.current[normalizedPath]) {
        console.log(`[FileManager] Prefetching ${normalizedPath}`)
        void prefetchDirectory(normalizedPath)
      }
    },
    [expandedPaths, prefetchDirectory]
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
                directoryCache={directoryCache}
                selectedPath={currentPath}
                loadingPaths={treeLoadingPaths}
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
  directoryCache: Record<string, K8sFileEntry[]>
  selectedPath: string
  loadingPaths: Set<string>
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
  loadingPaths,
  pendingPath,
  disabled
}: DirectoryTreeItemProps) {
  const normalizedPath = normalizeDirectoryPath(node.path)
  console.log(`[TreeItem] Rendering node: ${normalizedPath}`)
  const isExpanded = expandedPaths.has(normalizedPath)
  const isSelected = selectedPath === normalizedPath
  const isLoading = loadingPaths.has(normalizedPath) || pendingPath === normalizedPath
  const childDirectories = directoryCache[normalizedPath] ?? []
  const hasLoaded = Boolean(directoryCache[normalizedPath])
  const showToggle = node.isRoot || isLoading || childDirectories.length > 0 || !hasLoaded
  console.log(`[TreeItem] ${normalizedPath}: expanded=${isExpanded}, children=${childDirectories.length}, hasLoaded=${hasLoaded}`)

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
                loadingPaths={loadingPaths}
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
}, (prevProps, nextProps) => {
  // Custom memo comparator to debug infinite loops
  const nodeEqual = prevProps.node.path === nextProps.node.path
  const expandedPathsEqual = prevProps.expandedPaths === nextProps.expandedPaths
  const cacheEqual = prevProps.directoryCache === nextProps.directoryCache
  const selectedPathEqual = prevProps.selectedPath === nextProps.selectedPath
  const loadingPathsEqual = prevProps.loadingPaths === nextProps.loadingPaths
  const pendingPathEqual = prevProps.pendingPath === nextProps.pendingPath
  const disabledEqual = prevProps.disabled === nextProps.disabled
  
  const allEqual = nodeEqual && expandedPathsEqual && cacheEqual && selectedPathEqual && loadingPathsEqual && pendingPathEqual && disabledEqual
  
  if (!allEqual) {
    console.log(`[TreeItem] Memo check for ${nextProps.node.path}: CHANGED`, {
      nodeEqual,
      expandedPathsEqual,
      cacheEqual,
      selectedPathEqual,
      loadingPathsEqual,
      pendingPathEqual,
      disabledEqual
    })
  }
  
  return allEqual
})
