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
import { buildStartupCommandPreview } from '@/lib/startup-config'

interface ImportK8sServiceDialogProps {
  projectId: string
  projectIdentifier?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

const DEFAULT_NAMESPACE = 'default'

const getCommandPreview = (candidate: K8sImportCandidate): string | null => {
  const preview =
    buildStartupCommandPreview(candidate.startupConfig ?? null) ?? candidate.command ?? ''
  const trimmed = preview.trim()
  return trimmed.length ? trimmed : null
}

const formatCommand = (candidate: K8sImportCandidate) => {
  const preview = getCommandPreview(candidate)
  if (!preview) return '—'
  return preview.length > 80 ? `${preview.slice(0, 77)}...` : preview
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
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[1400px] lg:max-w-[1600px] xl:max-w-[1800px]">
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
              <div className="h-[560px] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                  {orderedCandidates.map((candidate) => (
                    <Card key={candidate.uid} className="flex h-full flex-col hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-200">
                      <CardHeader className="pb-3">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              {candidate.name}
                            </CardTitle>
                            <Badge variant="secondary" className="shrink-0">{candidate.kind}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs">📦 {candidate.namespace}</Badge>
                            <Badge variant="outline" className="text-xs">🔄 {candidate.replicas} 副本</Badge>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-1.5 rounded">
                            {candidate.image}{candidate.tag ? `:${candidate.tag}` : ''}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
                        <div className="flex-1 space-y-3">
                          {(() => {
                            const commandPreview = getCommandPreview(candidate)
                            const hasStartupDetails = Boolean(
                              commandPreview ||
                                candidate.startupConfig?.working_dir ||
                                (candidate.startupConfig?.args?.length ?? 0) > 0
                            )

                            if (!hasStartupDetails) {
                              return null
                            }

                            return (
                              <div className="space-y-1">
                                <Label className="text-xs font-medium text-gray-600">💻 启动配置</Label>
                                {commandPreview ? (
                                  <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded font-mono">
                                    {formatCommand(candidate)}
                                  </div>
                                ) : null}
                                {candidate.startupConfig?.working_dir && (
                                  <p className="text-xs text-gray-500">
                                    工作目录：
                                    <span className="font-mono bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">
                                      {candidate.startupConfig.working_dir}
                                    </span>
                                  </p>
                                )}
                                {candidate.startupConfig?.args?.length ? (
                                  <p className="text-xs text-gray-500">
                                    参数：{candidate.startupConfig.args.join(' ')}
                                  </p>
                                ) : null}
                              </div>
                            )
                          })()}

                          {candidate.networkConfig && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600">🌐 网络配置</Label>
                              <div className="rounded-lg border-2 border-blue-100 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                                <div className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                                  {candidate.networkConfig.service_type ?? 'ClusterIP'}
                                </div>
                                <div className="space-y-2">
                                  {'ports' in candidate.networkConfig && candidate.networkConfig.ports
                                    ? candidate.networkConfig.ports.map((port, index) => (
                                        <div
                                          key={`${candidate.uid}-port-${index}`}
                                          className="flex flex-wrap items-center gap-2 text-xs"
                                        >
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                            容器:{port.container_port}
                                          </Badge>
                                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                            Service:{port.service_port ?? port.container_port}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">{port.protocol ?? 'TCP'}</Badge>
                                          {typeof port.node_port === 'number' && (
                                            <Badge variant="outline" className="text-xs bg-purple-50">NodePort:{port.node_port}</Badge>
                                          )}
                                        </div>
                                      ))
                                    : 'container_port' in candidate.networkConfig && (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                            容器:{candidate.networkConfig.container_port}
                                          </Badge>
                                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                            Service:{candidate.networkConfig.service_port ?? candidate.networkConfig.container_port}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">{candidate.networkConfig.protocol ?? 'TCP'}</Badge>
                                          {typeof candidate.networkConfig.node_port === 'number' && (
                                            <Badge variant="outline" className="text-xs bg-purple-50">NodePort:{candidate.networkConfig.node_port}</Badge>
                                          )}
                                        </div>
                                      )}
                                </div>
                              </div>
                            </div>
                          )}

                          {candidate.containers.length > 1 && (
                            <div className="space-y-1">
                              <Label className="text-xs font-medium text-gray-600">📦 容器列表 ({candidate.containers.length})</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {candidate.containers.map((container) => (
                                  <Badge key={container.name} variant="outline" className="text-xs">
                                    {container.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <Button
                          type="button"
                          className="w-full gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all"
                          onClick={() => void handleImport(candidate)}
                          disabled={Boolean(importing)}
                        >
                          {importing === candidate.uid ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              导入中...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              导入为服务
                            </>
                          )}
                        </Button>
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
