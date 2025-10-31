'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxCreateNew
} from '@/components/ui/shadcn-io/combobox'
import { k8sSvc } from '@/service/k8sSvc'
import type { K8sImportCandidate } from '@/types/k8s'
import { Download, Loader2, RefreshCcw } from 'lucide-react'

interface ImportK8sServiceDialogProps {
  projectId: string
  projectIdentifier?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

const DEFAULT_NAMESPACE = 'default'

const formatCommand = (value?: string) => {
  if (!value) return '—'
  return value.length > 80 ? `${value.slice(0, 77)}...` : value
}

const organizeNamespaces = (values: string[]): string[] => {
  const unique = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length)
    )
  )

  if (!unique.includes(DEFAULT_NAMESPACE)) {
    unique.push(DEFAULT_NAMESPACE)
  }

  unique.sort((a, b) => {
    if (a === DEFAULT_NAMESPACE) return -1
    if (b === DEFAULT_NAMESPACE) return 1
    return a.localeCompare(b)
  })

  return unique
}

export function ImportK8sServiceDialog({
  projectId,
  projectIdentifier,
  open,
  onOpenChange,
  onImported
}: ImportK8sServiceDialogProps) {
  const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE)
  const [namespaceOptions, setNamespaceOptions] = useState<string[]>([DEFAULT_NAMESPACE])
  const namespaceRef = useRef(DEFAULT_NAMESPACE)
  const namespaceOptionsRef = useRef<string[]>([DEFAULT_NAMESPACE])
  const [namespacesLoading, setNamespacesLoading] = useState(false)
  const [namespaceError, setNamespaceError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<K8sImportCandidate[]>([])

  useEffect(() => {
    namespaceRef.current = namespace
  }, [namespace])

  useEffect(() => {
    namespaceOptionsRef.current = namespaceOptions
  }, [namespaceOptions])

  const loadNamespaces = useCallback(async (): Promise<string> => {
    setNamespacesLoading(true)
    setNamespaceError(null)

    try {
      const data = await k8sSvc.listNamespaces()
      const merged = organizeNamespaces([...namespaceOptionsRef.current, ...data])
      const resolved = merged.includes(namespaceRef.current) ? namespaceRef.current : merged[0] ?? DEFAULT_NAMESPACE

      setNamespaceOptions(merged)
      namespaceOptionsRef.current = merged
      setNamespace(resolved)
      namespaceRef.current = resolved

      return resolved
    } catch (err) {
      const message = err instanceof Error ? err.message : '命名空间列表加载失败'
      setNamespaceError(message)
      return namespaceRef.current
    } finally {
      setNamespacesLoading(false)
    }
  }, [])

  const loadCandidates = useCallback(async (ns: string) => {
    const targetNamespace = ns.trim() || DEFAULT_NAMESPACE
    setLoading(true)
    setError(null)

    try {
      const data = await k8sSvc.listImportableServices(targetNamespace)
      setCandidates(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败'
      setError(message)
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadNamespaces()
  }, [open, loadNamespaces])

  useEffect(() => {
    if (!open) {
      return
    }

    void loadCandidates(namespace)
  }, [open, namespace, loadCandidates])

  const orderedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => a.name.localeCompare(b.name))
  }, [candidates])

  const namespaceData = useMemo(
    () => namespaceOptions.map((item) => ({ label: item, value: item })),
    [namespaceOptions]
  )

  const handleNamespaceChange = useCallback((value: string) => {
    const normalized = value.trim() || DEFAULT_NAMESPACE
    const merged = organizeNamespaces([...namespaceOptionsRef.current, normalized])

    setNamespaceOptions(merged)
    namespaceOptionsRef.current = merged
    setNamespace(normalized)
    namespaceRef.current = normalized
  }, [])

  const handleRefresh = useCallback(async () => {
    const resolved = await loadNamespaces()
    await loadCandidates(resolved)
  }, [loadCandidates, loadNamespaces])

  const handleImport = useCallback(
    async (candidate: K8sImportCandidate) => {
      try {
        setImporting(candidate.uid)
        const result = await k8sSvc.importService(projectId, {
          namespace: candidate.namespace,
          name: candidate.name,
          kind: candidate.kind
        })

        toast.success(`已导入服务 ${result.name}`)
        onImported()
        onOpenChange(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : '导入失败'
        toast.error(message)
      } finally {
        setImporting(null)
      }
    },
    [onImported, onOpenChange, projectId]
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) {
          setCandidates([])
          setError(null)
          setNamespace(DEFAULT_NAMESPACE)
          namespaceRef.current = DEFAULT_NAMESPACE
          setNamespaceOptions([DEFAULT_NAMESPACE])
          namespaceOptionsRef.current = [DEFAULT_NAMESPACE]
          setNamespaceError(null)
          setLoading(false)
          setNamespacesLoading(false)
          setImporting(null)
        }
        onOpenChange(dialogOpen)
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>从 Kubernetes 导入服务</DialogTitle>
          <DialogDescription>
            选择集群中已有的 Deployment 或 StatefulSet，将其快速导入为项目服务配置。
            {projectIdentifier ? `导入后将归属项目编号 ${projectIdentifier}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 space-y-2">
              <Label htmlFor="namespace">命名空间</Label>
              <Combobox
                data={namespaceData}
                type="命名空间"
                value={namespace}
                onValueChange={handleNamespaceChange}
              >
                <ComboboxTrigger id="namespace" className="w-full justify-between">
                  <span className="truncate">{namespace}</span>
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxInput placeholder="搜索命名空间..." />
                  <ComboboxList>
                    <ComboboxEmpty>未找到命名空间</ComboboxEmpty>
                    <ComboboxGroup>
                      {namespaceData.map((item) => (
                        <ComboboxItem key={item.value} value={item.value}>
                          {item.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxGroup>
                  </ComboboxList>
                  <ComboboxCreateNew onCreateNew={handleNamespaceChange}>
                    {(value) => <span>使用自定义命名空间 “{value}”</span>}
                  </ComboboxCreateNew>
                </ComboboxContent>
              </Combobox>
              {namespaceError ? (
                <p className="text-xs text-red-500">{namespaceError}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2 self-start sm:self-end"
              onClick={() => void handleRefresh()}
              disabled={loading || namespacesLoading}
            >
              {loading || namespacesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              刷新
            </Button>
          </div>

          <div className="border-t" />

          <div className="rounded-lg border border-gray-200 p-4">
            {loading ? (
              <div className="flex h-[420px] items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载 Kubernetes 服务...
              </div>
            ) : error ? (
              <div className="flex h-[420px] items-center justify-center">
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              </div>
            ) : orderedCandidates.length === 0 ? (
              <div className="flex h-[420px] items-center justify-center text-sm text-gray-500">
                <div className="rounded-md border border-dashed border-gray-200 px-6 py-4">
                  当前命名空间内未找到可导入的 Deployment 或 StatefulSet
                </div>
              </div>
            ) : (
              <div className="h-[420px] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {orderedCandidates.map((candidate) => (
                    <Card key={candidate.uid} className="flex h-full flex-col">
                      <CardHeader className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {candidate.name}
                          </CardTitle>
                          <Badge variant="secondary">{candidate.kind}</Badge>
                          <Badge variant="outline">命名空间：{candidate.namespace}</Badge>
                          <Badge variant="outline">副本：{candidate.replicas}</Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          镜像：{candidate.image}
                          {candidate.tag ? `:${candidate.tag}` : ''}
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between gap-4">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs text-gray-500">启动命令</Label>
                            <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                              {formatCommand(candidate.command)}
                            </div>
                          </div>

                          {candidate.networkConfig && (
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-500">网络配置</Label>
                              <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                                <div className="mb-2 font-medium">
                                  Service 类型：{candidate.networkConfig.service_type ?? 'ClusterIP'}
                                </div>
                                <div className="space-y-1">
                                  {candidate.networkConfig.ports?.map((port, index) => (
                                    <div
                                      key={`${candidate.uid}-port-${index}`}
                                      className="flex flex-wrap items-center gap-3"
                                    >
                                      <Badge variant="outline">容器 {port.container_port}</Badge>
                                      <Badge variant="outline">
                                        Service {port.service_port ?? port.container_port}
                                      </Badge>
                                      <Badge variant="outline">协议 {port.protocol}</Badge>
                                      {typeof port.node_port === 'number' && (
                                        <Badge variant="outline">NodePort {port.node_port}</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {candidate.containers.length > 1 && (
                            <div className="space-y-2">
                              <Label className="text-xs text-gray-500">容器列表</Label>
                              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                {candidate.containers.map((container) => (
                                  <Badge key={container.name} variant="outline">
                                    {container.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end">
                          <Button
                            type="button"
                            className="gap-2"
                            onClick={() => void handleImport(candidate)}
                            disabled={Boolean(importing)}
                          >
                            {importing === candidate.uid ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            {importing === candidate.uid ? '导入中...' : '导入为服务'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
