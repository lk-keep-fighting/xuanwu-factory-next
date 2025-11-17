'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RefreshCcw, SendHorizontal, Users } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  type RequirementDetail,
  type RequirementProjectRef,
  type RequirementServiceRef
} from '@/types/requirement'
import { type AIEmployeeType, type AITaskPriority } from '@/types/ai'

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const buildRelativeTime = (value?: string) => {
  if (!value) return '暂无记录'
  const past = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - past.getTime()
  if (diffMs <= 0) return '刚刚'
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

type DetailMeta = {
  aiEmployees: Array<{ id: string; name: string; type: AIEmployeeType }>
  projects: RequirementProjectRef[]
  services: RequirementServiceRef[]
}

type DispatchFormState = {
  aiEmployeeIds: string[]
  taskTitle: string
  taskDescription: string
  branch: string
  expectedOutputs: string
  priority: AITaskPriority
}

const defaultDispatchForm: DispatchFormState = {
  aiEmployeeIds: [],
  taskTitle: '',
  taskDescription: '',
  branch: '',
  expectedOutputs: '',
  priority: 'MEDIUM'
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const requirementId = params?.id

  const [loading, setLoading] = useState(true)
  const [requirement, setRequirement] = useState<RequirementDetail | null>(null)
  const [meta, setMeta] = useState<DetailMeta | null>(null)

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false)
  const [dispatchForm, setDispatchForm] = useState<DispatchFormState>(defaultDispatchForm)
  const [dispatching, setDispatching] = useState(false)

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
      if (data?.data) {
        setDispatchForm({
          aiEmployeeIds: [],
          taskTitle: data.data.title,
          taskDescription: `请基于需求「${data.data.title}」完成对应工作。`,
          branch: '',
          expectedOutputs: '',
          priority: 'MEDIUM'
        })
      }
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

  const availableEmployees = meta?.aiEmployees ?? []

  const handleToggleEmployee = (employeeId: string) => {
    setDispatchForm((prev) => {
      const exists = prev.aiEmployeeIds.includes(employeeId)
      return {
        ...prev,
        aiEmployeeIds: exists
          ? prev.aiEmployeeIds.filter((id) => id !== employeeId)
          : [...prev.aiEmployeeIds, employeeId]
      }
    })
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
          requestedBy: 'mock-user',
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

  if (!requirementId) {
    return <div className="py-20 text-center text-gray-500">无效的需求 ID</div>
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
        <p>未找到对应的需求，可能已被删除。</p>
        <Button variant="outline" onClick={() => router.push('/requirements')}>
          返回需求列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400">创建于 {formatDateTime(requirement.createdAt)}</p>
          <h1 className="text-3xl font-bold text-gray-900">{requirement.title}</h1>
          <p className="text-sm text-gray-500">最近更新：{buildRelativeTime(requirement.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => router.push('/requirements')}>
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
          <Button className="gap-2" onClick={() => setDispatchDialogOpen(true)}>
            <SendHorizontal className="h-4 w-4" />
            派发任务
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">关联信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <div>
              <span className="text-xs text-gray-400">关联项目</span>
              <p className="mt-1 text-base font-medium text-gray-900">{requirement.project.name}</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">关联服务</span>
              <p className="mt-1">
                {requirement.services.length === 0
                  ? '未关联服务'
                  : requirement.services.map((service) => service.name).join('、')}
              </p>
            </div>
            <div className="flex flex-col gap-1 text-xs text-gray-500">
              <span>已派发：{requirement.aiTaskCount} 个任务</span>
              <span>最近派发：{buildRelativeTime(requirement.lastAiDispatchAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">快速操作</CardTitle>
            <Button variant="ghost" size="icon" onClick={loadRequirement}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <p>在此页面可以直接派发任务给 AI 员工，AI 任务会自动记录在下方列表中。</p>
            <Button className="w-full gap-2" onClick={() => setDispatchDialogOpen(true)}>
              <SendHorizontal className="h-4 w-4" />立即派发
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">AI 任务记录</CardTitle>
          <span className="text-xs text-gray-400">共 {requirement.taskLinks.length} 个任务</span>
        </CardHeader>
        <CardContent>
          {requirement.taskLinks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
              暂未派发 AI 任务，可通过右上角按钮体验派发流程。
            </div>
          ) : (
            <div className="space-y-4">
              {requirement.taskLinks.map((task) => (
                <div key={task.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{task.taskTitle}</p>
                      <p className="text-xs text-gray-500">
                        派发给 {task.aiEmployee.name} · 优先级 {task.priority}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">最近更新：{buildRelativeTime(task.updatedAt)}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      关联服务：{task.serviceName ?? '未指定'}
                    </div>
                    <div>任务状态：{task.status}</div>
                  </div>
                  {task.resultSummary ? (
                    <p className="mt-3 rounded bg-gray-50 p-3 text-xs text-gray-500">{task.resultSummary}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>派发需求给 AI 员工</DialogTitle>
            <DialogDescription>选择 AI 员工并补充任务说明，系统会模拟生成 AI 任务。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">AI 员工</span>
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
                          onClick={() => handleToggleEmployee(employee.id)}
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
                <p className="text-xs text-gray-400">已选择 {dispatchForm.aiEmployeeIds.length} 位 AI 员工</p>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">任务优先级</span>
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
                <label htmlFor="branch" className="text-sm font-medium text-gray-700">
                  关联分支（可选）
                </label>
                <Input
                  id="branch"
                  value={dispatchForm.branch}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, branch: event.target.value }))}
                  placeholder="例如：feature/requirement-ui"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="taskTitle" className="text-sm font-medium text-gray-700">
                  任务标题
                </label>
                <Input
                  id="taskTitle"
                  value={dispatchForm.taskTitle}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskTitle: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="taskDescription" className="text-sm font-medium text-gray-700">
                  任务描述
                </label>
                <Textarea
                  id="taskDescription"
                  value={dispatchForm.taskDescription}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskDescription: event.target.value }))}
                  className="h-40"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="expectedOutputs" className="text-sm font-medium text-gray-700">
                  期望产出（每行一项，可选）
                </label>
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
    </div>
  )
}
