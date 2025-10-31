'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { k8sSvc } from '@/service/k8sSvc'
import type { K8sImportCandidate } from '@/types/k8s'
import { Loader2, RefreshCcw, Download } from 'lucide-react'

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

export function ImportK8sServiceDialog({
  projectId,
  projectIdentifier,
  open,
  onOpenChange,
  onImported
}: ImportK8sServiceDialogProps) {
  const [namespace, setNamespace] = useState(DEFAULT_NAMESPACE)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<K8sImportCandidate[]>([])

  const loadCandidates = async (ns: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await k8sSvc.listImportableServices(ns)
      setCandidates(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败'
      setError(message)
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }

    void loadCandidates(namespace)
  }, [open, namespace])

  const orderedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => a.name.localeCompare(b.name))
  }, [candidates])

  const handleImport = async (candidate: K8sImportCandidate) => {
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
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen) {
          setCandidates([])
          setError(null)
          setNamespace(DEFAULT_NAMESPACE)
        }
        onOpenChange(dialogOpen)
      }}
    >
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>从 Kubernetes 导入服务</DialogTitle>
          <DialogDescription>
            选择集群中已有的 Deployment 或 StatefulSet，将其快速导入为项目服务配置。
            {projectIdentifier ? `导入后将归属项目编号 ${projectIdentifier}` : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] space-y-2">
              <Label htmlFor="namespace">命名空间</Label>
              <Input
                id="namespace"
                value={namespace}
                onChange={(event) => setNamespace(event.target.value.trim() || DEFAULT_NAMESPACE)}
                placeholder="默认 default"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => void loadCandidates(namespace)}
              disabled={loading}
            >
              <RefreshCcw className="h-4 w-4" />
              刷新
            </Button>
          </div>

          <div class="border-t" />

          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载 Kubernetes 服务...
            </div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          ) : orderedCandidates.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
              当前命名空间内未找到可导入的 Deployment 或 StatefulSet
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {orderedCandidates.map((candidate) => (
                <Card key={candidate.uid}>
                  <CardHeader className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <CardTitle className="text-lg font-semibold text-gray-900">
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
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-gray-500">启动命令</Label>
                      <div className="mt-1 text-sm text-gray-700">
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
                              <div key={`${candidate.uid}-port-${index}`} className="flex flex-wrap items-center gap-3">
                                <Badge variant="outline">容器 {port.container_port}</Badge>
                                <Badge variant="outline">Service {port.service_port}</Badge>
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
