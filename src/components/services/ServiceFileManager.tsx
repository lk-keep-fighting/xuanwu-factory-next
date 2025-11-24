'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Download, Folder, Loader2, RefreshCw, UploadCloud, File as FileIcon, ArrowUp } from 'lucide-react'
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

export function ServiceFileManager({ serviceId, active = true }: ServiceFileManagerProps) {
  const [entries, setEntries] = useState<K8sFileEntry[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pathInputValue, setPathInputValue] = useState('/')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const currentPathRef = useRef('/')

  const resetState = useCallback(() => {
    setEntries([])
    setCurrentPath('/')
    setParentPath(null)
    setHasInitialized(false)
    setError(null)
    setPathInputValue('/')
    currentPathRef.current = '/'
  }, [])

  useEffect(() => {
    resetState()
  }, [serviceId, resetState])

  const fetchEntries = useCallback(
    async (targetPath: string) => {
      if (!serviceId) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const data = await serviceSvc.listServiceFiles(serviceId, targetPath || '/')
        currentPathRef.current = data.path
        setEntries(data.entries)
        setCurrentPath(data.path)
        setParentPath(data.parentPath)
        setPathInputValue(data.path)
        setHasInitialized(true)
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : '加载文件失败'
        setError(message)
        toast.error(`加载文件失败：${message}`)
      } finally {
        setLoading(false)
      }
    },
    [serviceId]
  )

  useEffect(() => {
    if (active && serviceId && !hasInitialized && !loading) {
      void fetchEntries('/')
    }
  }, [active, serviceId, hasInitialized, loading, fetchEntries])

  const handlePathSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!serviceId || !active) {
        return
      }
      const target = pathInputValue.trim() || '/'
      void fetchEntries(target)
    },
    [serviceId, active, pathInputValue, fetchEntries]
  )

  const handleNavigate = useCallback(
    (target: string) => {
      if (!serviceId) {
        return
      }
      void fetchEntries(target)
    },
    [serviceId, fetchEntries]
  )

  const handleParentNavigate = useCallback(() => {
    if (parentPath) {
      void handleNavigate(parentPath)
    }
  }, [parentPath, handleNavigate])

  const handleRefresh = useCallback(() => {
    if (!serviceId) {
      return
    }
    void fetchEntries(currentPathRef.current)
  }, [serviceId, fetchEntries])

  const handleUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!serviceId) {
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
        toast.success(files.length > 1 ? `已上传 ${files.length} 个文件` : `文件 ${files[0]?.name ?? ''} 上传成功`)
        await fetchEntries(currentPathRef.current)
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
    [serviceId, fetchEntries]
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

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadChange}
      />
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

        <form onSubmit={handlePathSubmit} className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {breadcrumbItems.map((item, index) => (
            <div key={item.path} className="flex items-center gap-2">
              {index > 0 ? <span className="text-gray-400">/</span> : null}
              <button
                type="button"
                className={cn(
                  'text-sm font-medium text-blue-600 hover:underline',
                  item.path === currentPath ? 'cursor-default text-gray-900 no-underline' : undefined
                )}
                onClick={() => (item.path === currentPath ? undefined : handleNavigate(item.path))}
                disabled={item.path === currentPath || loading}
              >
                {item.label || '/'}
              </button>
            </div>
          ))}
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-md border">
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

              {entries.map((entry) => (
                <TableRow key={entry.path}>
                  <TableCell>
                    {entry.type === 'directory' ? (
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left"
                        onClick={() => handleNavigate(entry.path)}
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
  )
}
