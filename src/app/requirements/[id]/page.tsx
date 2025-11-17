'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Rocket,
  SendHorizontal,
  Sparkles,
  Users
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  type RequirementDetail,
  type RequirementPriority,
  type RequirementProjectRef,
  type RequirementServiceRef,
  type RequirementStatus,
  type RequirementStatusHistoryEntry
} from '@/types/requirement'
import {
  type AIEmployeeType,
  type AITaskPriority,
  type AITaskStatus
} from '@/types/ai'

import { RequirementDueIndicator } from '../components/due-indicator'
import { SimpleMarkdownViewer } from '../components/markdown-viewer'
import { RequirementPriorityBadge } from '../components/priority-badge'
import { PersonAvatar } from '../components/person-avatar'
import { RequirementStatusBadge, requirementStatusMeta } from '../components/status-badge'

const TASK_STATUS_META: Record<AITaskStatus, { label: string; className: string }> = {
  PENDING: { label: '待开始', className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  IN_PROGRESS: { label: '执行中', className: 'bg-sky-50 text-sky-600 border border-sky-200' },
  SUCCESS: { label: '已完成', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  FAILED: { label: '已失败', className: 'bg-rose-50 text-rose-600 border border-rose-200' }
}

const PRIORITY_LABEL: Record<AITaskPriority, string> = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低'
}

type DetailMeta = {
  nextStatuses: RequirementStatus[]
  aiEmployees: Array<{ id: string; name: string; type: AIEmployeeType }>
  projects: RequirementProjectRef[]
  services: RequirementServiceRef[]
  people: Array<{ id: string; name: string }>
  priorities: RequirementPriority[]
  statuses: RequirementStatus[]
}

type DispatchFormState = {
  aiEmployeeIds: string[]
  taskTitle: string
  taskDescription: string
  branch: string
  expectedOutputs: string
  priority: AITaskPriority
}

type EditRequirementForm = {
  title: string
  description: string
  projectId: string
  serviceIds: string[]
  priority: RequirementPriority
  ownerId: string
  watcherIds: string[]
  dueAt: string
  tags: string
}

const buildRelativeTime = (dateString?: string) => {
  if (!dateString) return '暂无记录'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return '即将发生'
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} 天前`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} 个月前`
  return `${Math.floor(diffMonths / 12)} 年前`
}

const formatTimelineTime = (value: string) => {
  const date = new Date(value)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const summarizeServices = (services: RequirementServiceRef[]) => {
  if (services.length === 0) return '未关联服务'
  return services.map((service) => service.name).join('，')
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const requirementId = params?.id

  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [dispatching, setDispatching] = useState(false)
  const [updating, setUpdating] = useState(false)

  const [requirement, setRequirement] = useState<RequirementDetail | null>(null)
  const [meta, setMeta] = useState<DetailMeta | null>(null)

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false)
  const [dispatchForm, setDispatchForm] = useState<DispatchFormState>({
    aiEmployeeIds: [],
    taskTitle: '',
    taskDescription: '',
    branch: '',
    expectedOutputs: '',
    priority: 'MEDIUM'
  })

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditRequirementForm | null>(null)
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit')

  const loadRequirement = useCallback(async () => {
    if (!requirementId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/requirements/${requirementId}`)
      if (!res.ok) {
        throw new Error('加载需求详情失败')
      }
      const data = await res.json()
      setRequirement(data?.data ?? null)
      setMeta(data?.meta ?? null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载需求详情失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [requirementId])

  useEffect(() => {
    loadRequirement()
  }, [loadRequirement])

  useEffect(() => {
    if (!requirement) return
    setDispatchForm({
      aiEmployeeIds: [],
      taskTitle: requirement.title,
      taskDescription: `请基于以下需求内容执行：\n\n${requirement.description}`,
      branch: '',
      expectedOutputs: '',
      priority: requirement.priority
    })
  }, [requirement])

  const handleStatusChange = async (nextStatus: RequirementStatus) => {
    if (!requirement) return
    const operator = requirement.owner?.id ?? meta?.people?.[0]?.id
    if (!operator) {
      toast.error('缺少操作者信息，无法变更状态')
      return
    }

    setSavingStatus(true)
    try {
      const response = await fetch(`/api/requirements/${requirement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'statusChange',
          toStatus: nextStatus,
          changedBy: operator,
          note: `前端原型中手动切换至 ${requirementStatusMeta[nextStatus]?.label ?? nextStatus}`
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result?.error || '状态更新失败')
      }

      toast.success('状态更新成功')
      await loadRequirement()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '状态更新失败'
      toast.error(message)
    } finally {
      setSavingStatus(false)
    }
  }

  const openEditDialog = () => {
    if (!requirement) return
    setEditForm({
      title: requirement.title,
      description: requirement.description,
      projectId: requirement.project.id,
      serviceIds: requirement.services.map((service) => service.id),
      priority: requirement.priority,
      ownerId: requirement.owner.id,
      watcherIds: requirement.watchers.map((watcher) => watcher.id),
      dueAt: requirement.dueAt ? requirement.dueAt.split('T')[0] : '',
      tags: requirement.tags.join(', ')
    })
    setEditTab('edit')
    setEditDialogOpen(true)
  }

  const handleUpdateRequirement = async () => {
    if (!requirement || !editForm) return
    if (!editForm.title.trim()) {
      toast.error('请输入需求标题')
      return
    }
    if (!editForm.description.trim()) {
      toast.error('请填写需求描述')
      return
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/requirements/${requirement.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description,
          projectId: editForm.projectId,
          serviceIds: editForm.serviceIds,
          priority: editForm.priority,
          ownerId: editForm.ownerId,
          watcherIds: editForm.watcherIds,
          dueAt: editForm.dueAt || null,
          tags: editForm.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
          updatedBy: editForm.ownerId
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result?.error || '更新需求失败')
      }

      toast.success('需求信息已更新')
      setEditDialogOpen(false)
      await loadRequirement()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新需求失败'
      toast.error(message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDispatch = async () => {
    if (!requirement) return
    if (dispatchForm.aiEmployeeIds.length === 0) {
      toast.error('请选择至少一位 AI 员工')
      return
    }
    if (!dispatchForm.taskTitle.trim()) {
      toast.error('请填写任务标题')
      return
    }
    if (!dispatchForm.taskDescription.trim()) {
      toast.error('请填写任务描述')
      return
    }

    setDispatching(true)
    try {
      const response = await fetch(`/api/requirements/${requirement.id}/dispatch-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiEmployeeIds: dispatchForm.aiEmployeeIds,
          taskTitle: dispatchForm.taskTitle,
          taskDescription: dispatchForm.taskDescription,
          branch: dispatchForm.branch || undefined,
          expectedOutputs: dispatchForm.expectedOutputs
            .split('\n')
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
          priority: dispatchForm.priority,
          requestedBy: requirement.owner.id,
          projectId: requirement.project.id,
          serviceIds: requirement.services.map((service) => service.id)
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result?.error || '派发失败')
      }

      toast.success('已模拟派发任务给 AI 员工')
      setDispatchDialogOpen(false)
      await loadRequirement()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '派发任务失败'
      toast.error(message)
    } finally {
      setDispatching(false)
    }
  }

  const nextStatuses = meta?.nextStatuses ?? []
  const availableEmployees = meta?.aiEmployees ?? []

  if (!requirementId) {
    return (
      <div className="py-20 text-center text-gray-500">无效的需求 ID</div>
    )
  }

  if (loading && !requirement) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>需求详情加载中...</p>
      </div>
    )
  }

  if (!requirement) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
        <AlertTriangle className="h-6 w-6" />
        <p>未找到对应的需求，可能已被删除。</p>
        <Button variant="outline" onClick={() => router.push('/requirements')}>
          返回需求列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-primary" />
              需求编号：{requirement.code}
            </span>
            <span className="text-xs text-gray-400">最近更新：{buildRelativeTime(requirement.updatedAt)}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{requirement.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <RequirementStatusBadge status={requirement.status} />
            <RequirementPriorityBadge priority={requirement.priority} />
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              <Activity className="h-3.5 w-3.5" />
              完成度 {requirement.progressPercentage}%
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              风险等级 {requirement.riskLevel === 'HIGH' ? '高' : requirement.riskLevel === 'MEDIUM' ? '中' : '低'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/requirements')}>
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={savingStatus || nextStatuses.length === 0}>
                <MoreHorizontal className="h-4 w-4" />
                状态流转
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuLabel>切换到</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {nextStatuses.length === 0 ? (
                <DropdownMenuItem disabled>暂无可切换的状态</DropdownMenuItem>
              ) : (
                nextStatuses.map((status) => (
                  <DropdownMenuItem key={status} onClick={() => handleStatusChange(status)}>
                    {requirementStatusMeta[status]?.label ?? status}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" className="gap-2" onClick={openEditDialog}>
            <Pencil className="h-4 w-4" />
            编辑信息
          </Button>
          <Button className="gap-2" onClick={() => setDispatchDialogOpen(true)}>
            <SendHorizontal className="h-4 w-4" />
            派发给 AI 员工
          </Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">需求描述</CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleMarkdownViewer content={requirement.description} />
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">AI 协同任务</CardTitle>
              <span className="text-xs text-gray-400">共 {requirement.taskLinks.length} 个</span>
            </CardHeader>
            <CardContent className="space-y-4">
              {requirement.taskLinks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                  暂未派发 AI 任务，可通过右上角按钮体验派发流程。
                </div>
              ) : (
                requirement.taskLinks.map((task) => {
                  const statusMeta = TASK_STATUS_META[task.status]
                  return (
                    <div key={task.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{task.taskTitle}</span>
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border', statusMeta.className)}>
                            {statusMeta.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                            优先级 {PRIORITY_LABEL[task.priority]}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">最近更新：{buildRelativeTime(task.updatedAt)}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5" />
                          派发给：{task.aiEmployee.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          创建于：{formatTimelineTime(task.createdAt)}
                        </div>
                      </div>
                      {task.resultSummary ? (
                        <p className="mt-3 rounded bg-gray-50 p-3 text-xs text-gray-500">{task.resultSummary}</p>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">状态变更记录</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {requirement.statusHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                    暂无状态变更记录
                  </div>
                ) : (
                  requirement.statusHistory.map((entry: RequirementStatusHistoryEntry, index) => (
                    <div key={entry.id} className="relative pl-6">
                      {index !== requirement.statusHistory.length - 1 ? (
                        <span className="absolute left-[9px] top-4 h-full w-px bg-gray-200" />
                      ) : null}
                      <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-primary bg-white" />
                      <div className="text-xs text-gray-400">{formatTimelineTime(entry.createdAt)}</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">
                        {requirementStatusMeta[entry.fromStatus ?? 'DRAFT']?.label ?? entry.fromStatus ?? '创建'} →{' '}
                        {requirementStatusMeta[entry.toStatus]?.label ?? entry.toStatus}
                      </div>
                      <div className="text-xs text-gray-500">操作人：{entry.changedBy.name}</div>
                      {entry.note ? <div className="mt-1 text-xs text-gray-500">备注：{entry.note}</div> : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900">责任人</CardTitle>
            </CardHeader>
            <CardContent>
              <PersonAvatar person={requirement.owner} />
              <div className="mt-4 space-y-3 text-xs text-gray-500">
                <RequirementDueIndicator
                  dueAt={requirement.dueAt}
                  status={requirement.status}
                  remainingDays={requirement.remainingDays}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">关注人</span>
                  {requirement.watchers.length === 0 ? (
                    <span className="text-xs text-gray-400">暂无关注人</span>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {requirement.watchers.map((watcher) => (
                        <span key={watcher.id} className="rounded-full bg-gray-100 px-2 py-0.5">
                          {watcher.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900">项目关联信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                <span className="font-medium text-gray-900">{requirement.project.name}</span>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <div className="font-medium text-gray-600">关联服务</div>
                <div className="mt-1 leading-6">{summarizeServices(requirement.services)}</div>
              </div>
              <div className="text-xs text-gray-400">
                最近派发：{buildRelativeTime(requirement.lastAiDispatchAt)}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-gray-900">标签与备注</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              {requirement.tags.length === 0 ? (
                <div className="rounded border border-dashed border-gray-200 p-3 text-xs text-gray-400">
                  暂无标签，可在编辑信息中补充
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {requirement.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              {requirement.lastUpdatedBy ? (
                <div className="text-xs text-gray-400">
                  最近更新人：{requirement.lastUpdatedBy.name}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>派发需求给 AI 员工</DialogTitle>
            <DialogDescription>该操作将模拟调用派发接口，并在右侧列表中生成关联任务。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>选择 AI 员工</Label>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto rounded border border-gray-200 p-3">
                  {availableEmployees.length === 0 ? (
                    <span className="text-xs text-gray-400">暂无可用的 AI 员工</span>
                  ) : (
                    availableEmployees.map((employee) => {
                      const checked = dispatchForm.aiEmployeeIds.includes(employee.id)
                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => {
                            setDispatchForm((prev) => ({
                              ...prev,
                              aiEmployeeIds: checked
                                ? prev.aiEmployeeIds.filter((id) => id !== employee.id)
                                : [...prev.aiEmployeeIds, employee.id]
                            }))
                          }}
                          className={cn(
                            'flex items-center justify-between rounded border px-3 py-2 text-sm transition',
                            checked
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                          )}
                        >
                          <span>{employee.name}</span>
                          <span className="text-xs text-gray-400">
                            {employee.type === 'ENGINEER' ? '研发' : '测试'}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  已选择 {dispatchForm.aiEmployeeIds.length} 位 AI 员工
                </p>
              </div>
              <div className="space-y-2">
                <Label>任务优先级</Label>
                <Select
                  value={dispatchForm.priority}
                  onValueChange={(value) => setDispatchForm((prev) => ({ ...prev, priority: value as AITaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择优先级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">高</SelectItem>
                    <SelectItem value="MEDIUM">中</SelectItem>
                    <SelectItem value="LOW">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">关联分支（可选）</Label>
                <Input
                  id="branch"
                  value={dispatchForm.branch}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, branch: event.target.value }))}
                  placeholder="例如：feature/requirement-frontend"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taskTitle">任务标题</Label>
                <Input
                  id="taskTitle"
                  value={dispatchForm.taskTitle}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskTitle: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskDescription">任务描述</Label>
                <Textarea
                  id="taskDescription"
                  value={dispatchForm.taskDescription}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskDescription: event.target.value }))}
                  className="h-40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedOutputs">期望产出（每行一项，可选）</Label>
                <Textarea
                  id="expectedOutputs"
                  value={dispatchForm.expectedOutputs}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, expectedOutputs: event.target.value }))}
                  className="h-24"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDispatchDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleDispatch} disabled={dispatching} className="gap-2">
                  {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  派发任务
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>编辑需求信息</DialogTitle>
            <DialogDescription>调整需求的基础属性与描述内容，保存后刷新右侧信息面板。</DialogDescription>
          </DialogHeader>
          {editForm ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">需求标题</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(event) => setEditForm((prev) => prev && ({ ...prev, title: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>关联项目</Label>
                  <Select
                    value={editForm.projectId}
                    onValueChange={(value) =>
                      setEditForm((prev) =>
                        prev && ({
                          ...prev,
                          projectId: value,
                          serviceIds: (meta?.services ?? [])
                            .filter((service) => service.projectId === value)
                            .slice(0, 1)
                            .map((service) => service.id)
                        })
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择项目" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta?.projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>关联服务</Label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-3 text-sm">
                    {(meta?.services ?? [])
                      .filter((service) => service.projectId === editForm.projectId)
                      .map((service) => {
                        const checked = editForm.serviceIds.includes(service.id)
                        return (
                          <label key={service.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setEditForm((prev) =>
                                  prev && ({
                                    ...prev,
                                    serviceIds: event.target.checked
                                      ? [...prev.serviceIds, service.id]
                                      : prev.serviceIds.filter((id) => id !== service.id)
                                  })
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300"
                            />
                            <span>{service.name}</span>
                          </label>
                        )
                      })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>优先级</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(value) =>
                        setEditForm((prev) => prev && ({ ...prev, priority: value as RequirementPriority }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择优先级" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HIGH">高</SelectItem>
                        <SelectItem value="MEDIUM">中</SelectItem>
                        <SelectItem value="LOW">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>责任人</Label>
                    <Select
                      value={editForm.ownerId}
                      onValueChange={(value) =>
                        setEditForm((prev) => prev && ({ ...prev, ownerId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择责任人" />
                      </SelectTrigger>
                      <SelectContent>
                        {meta?.people?.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>关注人</Label>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto rounded border border-gray-200 p-3 text-sm">
                    {(meta?.people ?? []).map((person) => {
                      const checked = editForm.watcherIds.includes(person.id)
                      return (
                        <label key={person.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setEditForm((prev) =>
                                prev && ({
                                  ...prev,
                                  watcherIds: event.target.checked
                                    ? [...prev.watcherIds, person.id]
                                    : prev.watcherIds.filter((id) => id !== person.id)
                                })
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span>{person.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dueAt">截止日期</Label>
                  <Input
                    id="edit-dueAt"
                    type="date"
                    value={editForm.dueAt}
                    onChange={(event) => setEditForm((prev) => prev && ({ ...prev, dueAt: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tags">标签（逗号分隔）</Label>
                  <Input
                    id="edit-tags"
                    value={editForm.tags}
                    onChange={(event) => setEditForm((prev) => prev && ({ ...prev, tags: event.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <Label>需求描述（Markdown）</Label>
                <Tabs value={editTab} onValueChange={(value) => setEditTab(value as 'edit' | 'preview')}>
                  <TabsList>
                    <TabsTrigger value="edit">编辑</TabsTrigger>
                    <TabsTrigger value="preview">预览</TabsTrigger>
                  </TabsList>
                  <TabsContent value="edit" className="mt-2">
                    <Textarea
                      value={editForm.description}
                      onChange={(event) =>
                        setEditForm((prev) => prev && ({ ...prev, description: event.target.value }))
                      }
                      className="h-[320px]"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <div className="h-[320px] overflow-y-auto rounded border border-gray-200 bg-gray-50 p-4">
                      <SimpleMarkdownViewer content={editForm.description} />
                    </div>
                  </TabsContent>
                </Tabs>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleUpdateRequirement} disabled={updating} className="gap-2">
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    保存变更
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
