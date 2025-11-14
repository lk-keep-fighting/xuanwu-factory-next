'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Braces,
  ClipboardList,
  Loader2,
  MoreHorizontal,
  Rocket,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  Workflow
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AIEmployeeDetail,
  AIEmployeeStatus,
  AIRoleTemplateListItem,
  AITaskAssignment,
  AITaskPriority,
  AITaskStatus
} from '@/types/ai'
import { cn } from '@/lib/utils'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const STATUS_STYLE: Record<AIEmployeeStatus, { label: string; className: string }> = {
  ACTIVE: { label: '已启用', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  DISABLED: { label: '已停用', className: 'bg-gray-100 text-gray-500 border border-gray-200' }
}

const TASK_STATUS: Record<AITaskStatus, { label: string; className: string }> = {
  PENDING: { label: '待执行', className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  IN_PROGRESS: { label: '执行中', className: 'bg-amber-50 text-amber-600 border border-amber-200' },
  SUCCESS: { label: '已完成', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  FAILED: { label: '执行失败', className: 'bg-rose-50 text-rose-600 border border-rose-200' }
}

const TASK_PRIORITY: Record<AITaskPriority, { label: string; className: string }> = {
  HIGH: { label: '高', className: 'bg-red-50 text-red-600 border border-red-200' },
  MEDIUM: { label: '中', className: 'bg-blue-50 text-blue-600 border border-blue-200' },
  LOW: { label: '低', className: 'bg-gray-100 text-gray-500 border border-gray-200' }
}

const TYPE_LABEL = {
  ENGINEER: '研发人员',
  QA: '测试人员'
}

const formatDateTime = (value?: string) => {
  if (!value) return '暂无记录'
  const date = new Date(value)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

const formatRelative = (value?: string) => {
  if (!value) return '暂无记录'
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) {
    const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)))
    return `${minutes} 分钟前`
  }
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} 天前`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} 个月前`
  return `${Math.floor(diffMonths / 12)} 年前`
}

const dispatchInitialState = {
  projectId: '',
  applicationId: '',
  branchName: '',
  taskTitle: '',
  taskDescription: '',
  expectedOutputs: '',
  priority: 'MEDIUM' as AITaskPriority
}

type TaskPagination = {
  total: number
  page: number
  pageSize: number
}

type EmployeeFormState = {
  modelProvider: string
  modelName: string
  temperature: string
  maxTokens: string
  capabilityTags: string
  description: string
  status: AIEmployeeStatus
}

const toCapabilityString = (tags: string[]) => tags.join(', ')

export default function AiEmployeeDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const employeeId = params?.id

  const [employee, setEmployee] = useState<AIEmployeeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<AIRoleTemplateListItem[]>([])
  const [tasks, setTasks] = useState<AITaskAssignment[]>([])
  const [taskLoading, setTaskLoading] = useState(true)
  const [taskPagination, setTaskPagination] = useState<TaskPagination>({ total: 0, page: 1, pageSize: 10 })
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | AITaskStatus>('ALL')

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false)
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false)
  const [dispatchForm, setDispatchForm] = useState(dispatchInitialState)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editForm, setEditForm] = useState<EmployeeFormState>({
    modelProvider: '',
    modelName: '',
    temperature: '0.3',
    maxTokens: '2048',
    capabilityTags: '',
    description: '',
    status: 'ACTIVE'
  })

  const loadEmployee = useCallback(async () => {
    if (!employeeId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/ai/employees/${employeeId}`)
      if (!res.ok) {
        throw new Error('加载 AI 员工详情失败')
      }
      const data = await res.json()
      setEmployee(data)
      setEditForm({
        modelProvider: data.modelProvider,
        modelName: data.modelName,
        temperature: String(data.modelParams?.temperature ?? 0.3),
        maxTokens: String(data.modelParams?.maxTokens ?? 2048),
        capabilityTags: toCapabilityString(data.capabilityTags ?? []),
        description: data.description ?? '',
        status: data.status
      })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '加载员工详情失败')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/role-templates')
      if (!res.ok) throw new Error('加载角色模板失败')
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '加载角色模板失败')
    }
  }, [])

  const loadTasks = useCallback(
    async (page = taskPagination.page, status = taskStatusFilter) => {
      if (!employeeId) return
      try {
        setTaskLoading(true)
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(taskPagination.pageSize)
        })
        if (status && status !== 'ALL') {
          params.set('status', status)
        }
        const res = await fetch(`/api/ai/employees/${employeeId}/tasks?${params.toString()}`)
        if (!res.ok) {
          throw new Error('加载任务记录失败')
        }
        const data = await res.json()
        setTasks(Array.isArray(data?.data) ? data.data : [])
        if (data?.pagination) {
          setTaskPagination((prev) => ({
            ...prev,
            total: data.pagination.total ?? 0,
            page: data.pagination.page ?? page
          }))
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : '加载任务失败')
      } finally {
        setTaskLoading(false)
      }
    },
    [employeeId, taskPagination.pageSize, taskStatusFilter]
  )

  useEffect(() => {
    loadEmployee()
    loadTemplates()
  }, [loadEmployee, loadTemplates])

  useEffect(() => {
    loadTasks(1, taskStatusFilter)
  }, [loadTasks, taskStatusFilter])

  const templateDetail = useMemo(() => {
    if (!employee?.roleTemplate) return null
    return templates.find((item) => item.id === employee.roleTemplate?.id) ?? employee.roleTemplate
  }, [employee?.roleTemplate, templates])

  const handleDispatch = async () => {
    if (!employeeId) return
    if (!dispatchForm.projectId || !dispatchForm.applicationId || !dispatchForm.branchName) {
      toast.error('请完善任务上下文信息')
      return
    }
    if (!dispatchForm.taskTitle.trim() || !dispatchForm.taskDescription.trim()) {
      toast.error('请填写任务标题与描述')
      return
    }

    setDispatchSubmitting(true)
    try {
      const expectedOutputs = dispatchForm.expectedOutputs
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

      const payload = {
        projectId: dispatchForm.projectId.trim(),
        applicationId: dispatchForm.applicationId.trim(),
        branchName: dispatchForm.branchName.trim(),
        taskTitle: dispatchForm.taskTitle.trim(),
        taskDescription: dispatchForm.taskDescription.trim(),
        expectedOutputs,
        priority: dispatchForm.priority
      }

      const res = await fetch(`/api/ai/employees/${employeeId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result?.error || '派发任务失败')
      }

      toast.success(`任务已派发，ID：${result.taskId}`)
      setDispatchDialogOpen(false)
      setDispatchForm(dispatchInitialState)
      await Promise.all([loadEmployee(), loadTasks()])
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '任务派发失败')
    } finally {
      setDispatchSubmitting(false)
    }
  }

  const handleStatusToggle = async () => {
    if (!employeeId || !employee) return
    const nextStatus: AIEmployeeStatus = employee.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/ai/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result?.error || '状态更新失败')
      }
      toast.success(`员工已${nextStatus === 'ACTIVE' ? '启用' : '停用'}`)
      await loadEmployee()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '状态更新失败')
    }
  }

  const handleEditSubmit = async () => {
    if (!employeeId) return
    setEditSubmitting(true)
    try {
      const metadata = {
        modelProvider: editForm.modelProvider.trim(),
        modelName: editForm.modelName.trim(),
        modelParams: {
          temperature: Number.parseFloat(editForm.temperature),
          maxTokens: Number.parseInt(editForm.maxTokens, 10)
        },
        capabilityTags: editForm.capabilityTags
          .split(',')
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        description: editForm.description.trim(),
        status: editForm.status
      }

      if (!metadata.modelProvider || !metadata.modelName) {
        throw new Error('请填写完整的模型信息')
      }

      const res = await fetch(`/api/ai/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result?.error || '更新失败')
      }

      toast.success('员工信息已更新')
      setEditDialogOpen(false)
      await loadEmployee()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '更新失败')
    } finally {
      setEditSubmitting(false)
    }
  }

  if (!employeeId) {
    return (
      <div className="py-20 text-center text-gray-500">未找到对应的 AI 员工</div>
    )
  }

  if (loading && !employee) {
    return (
      <div className="py-20 text-center text-gray-400">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        正在加载员工详情...
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="space-y-6 text-center">
        <div className="py-16 text-gray-400">
          <Workflow className="mx-auto mb-4 h-10 w-10" />
          未找到该 AI 员工，可能已被删除。
        </div>
        <Button onClick={() => router.push('/ai/employees')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> 返回员工列表
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="-ml-3 gap-2" onClick={() => router.push('/ai/employees')}>
              <ArrowLeft className="h-4 w-4" /> 返回列表
            </Button>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
              {TYPE_LABEL[employee.type] ?? employee.type}
            </span>
            <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', STATUS_STYLE[employee.status].className)}>
              {STATUS_STYLE[employee.status].label}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-gray-900">{employee.name}</h1>
            <p className="text-sm text-gray-500">累计执行任务 {employee.totalTaskCount} 个 · 最近任务 {formatRelative(employee.lastTaskAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={handleStatusToggle}>
            <ShieldCheck className="h-4 w-4" />
            {employee.status === 'ACTIVE' ? '停用员工' : '启用员工'}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setEditDialogOpen(true)}>
            <Settings2 className="h-4 w-4" /> 编辑信息
          </Button>
          <Button className="gap-2" onClick={() => setDispatchDialogOpen(true)}>
            <Send className="h-4 w-4" /> 派发任务
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> 员工画像
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase">关联角色模板</p>
                <Link href="/ai/role-templates" className="text-sm font-semibold text-primary hover:underline">
                  {employee.roleTemplate?.name ?? '未设置'}
                </Link>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">员工简介</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-700">
                  {employee.description || '暂无介绍'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">能力标签</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {employee.capabilityTags.length === 0 ? (
                    <span className="text-xs text-gray-400">未配置标签</span>
                  ) : (
                    employee.capabilityTags.map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        <Tag className="mr-1 h-3 w-3 text-gray-400" />
                        {tag}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 uppercase">创建时间</p>
                <p className="mt-1 text-sm text-gray-700">{formatDateTime(employee.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">最近任务</p>
                <p className="mt-1 text-sm text-gray-700">{formatRelative(employee.lastTaskAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">模型配置</p>
                <p className="mt-1 text-sm text-gray-700">
                  {employee.modelProvider} · {employee.modelName}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Braces className="h-5 w-5 text-primary" /> 默认模型参数
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>温度 (temperature)</span>
              <span className="font-semibold text-gray-900">{employee.modelParams?.temperature ?? '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>最大 Tokens</span>
              <span className="font-semibold text-gray-900">{employee.modelParams?.maxTokens ?? '-'}</span>
            </div>
            {'topP' in (employee.modelParams ?? {}) ? (
              <div className="flex items-center justify-between">
                <span>Top P</span>
                <span className="font-semibold text-gray-900">{employee.modelParams?.topP}</span>
              </div>
            ) : null}
            {'presencePenalty' in (employee.modelParams ?? {}) ? (
              <div className="flex items-center justify-between">
                <span>Presence Penalty</span>
                <span className="font-semibold text-gray-900">{employee.modelParams?.presencePenalty}</span>
              </div>
            ) : null}
            {'frequencyPenalty' in (employee.modelParams ?? {}) ? (
              <div className="flex items-center justify-between">
                <span>Frequency Penalty</span>
                <span className="font-semibold text-gray-900">{employee.modelParams?.frequencyPenalty}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-gray-900">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle>任务派发记录</CardTitle>
            <span className="rounded-full bg-gray-100 px-2 text-xs text-gray-500">共 {taskPagination.total} 条</span>
          </div>
          <div className="flex items-center gap-3">
            <Select value={taskStatusFilter} onValueChange={(value) => setTaskStatusFilter(value as 'ALL' | AITaskStatus)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="PENDING">待执行</SelectItem>
                <SelectItem value="IN_PROGRESS">执行中</SelectItem>
                <SelectItem value="SUCCESS">已完成</SelectItem>
                <SelectItem value="FAILED">执行失败</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => loadTasks(1, taskStatusFilter)}
              disabled={taskLoading}
            >
              <RotateCcw className={cn('h-4 w-4', taskLoading ? 'animate-spin' : '')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {taskLoading ? (
            <div className="py-12 text-center text-gray-400">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
              正在加载任务数据...
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Rocket className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              暂无任务记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-44">任务标题</TableHead>
                  <TableHead className="w-36">项目 / 应用</TableHead>
                  <TableHead className="w-32">分支</TableHead>
                  <TableHead className="w-24">优先级</TableHead>
                  <TableHead className="w-28">状态</TableHead>
                  <TableHead className="w-40">派发时间</TableHead>
                  <TableHead>摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const statusMeta = TASK_STATUS[task.status]
                  const priorityMeta = TASK_PRIORITY[task.priority]
                  return (
                    <TableRow key={task.id} className="hover:bg-gray-50/80">
                      <TableCell>
                        <div className="font-medium text-gray-900">{task.taskTitle}</div>
                        <div className="text-xs text-gray-500">#{task.id}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-700">{task.projectId}</div>
                        <div className="text-xs text-gray-400">{task.applicationId}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{task.branchName}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', priorityMeta.className)}>
                          {priorityMeta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', statusMeta.className)}>
                          {statusMeta.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-700">{formatDateTime(task.createdAt)}</div>
                        <div className="text-xs text-gray-400">更新于 {formatRelative(task.updatedAt)}</div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-600 line-clamp-2">{task.resultSummary ?? '暂无摘要'}</p>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {taskPagination.total > taskPagination.pageSize ? (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-500">
            <span>
              第 {taskPagination.page} 页 · 共 {Math.ceil(taskPagination.total / taskPagination.pageSize)} 页
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={taskPagination.page <= 1}
                onClick={() => loadTasks(taskPagination.page - 1, taskStatusFilter)}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={taskPagination.page >= Math.ceil(taskPagination.total / taskPagination.pageSize)}
                onClick={() => loadTasks(taskPagination.page + 1, taskStatusFilter)}
              >
                下一页
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {templateDetail ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" /> 模板规范（{templateDetail.name}）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-gray-600">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">System Prompt</h3>
              <p className="rounded-md bg-gray-900/95 p-4 text-sm leading-relaxed text-gray-100">
                {templateDetail.systemPrompt}
              </p>
            </section>
            {templateDetail.behaviorGuidelines.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">行为约束</h3>
                <ul className="space-y-2">
                  {templateDetail.behaviorGuidelines.map((rule) => (
                    <li key={rule} className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                      <span className="text-gray-700">{rule}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {templateDetail.toolPermissions.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">推荐工具权限</h3>
                <div className="flex flex-wrap gap-2">
                  {templateDetail.toolPermissions.map((tool) => (
                    <span key={tool} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                      <MoreHorizontal className="h-3 w-3 text-gray-400" />
                      {tool}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* 派发任务弹窗 */}
      <Dialog open={dispatchDialogOpen} onOpenChange={(open) => {
        setDispatchDialogOpen(open)
        if (!open) setDispatchForm(dispatchInitialState)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>派发新任务</DialogTitle>
            <DialogDescription>为 {employee.name} 指派新的任务，系统将返回 Mock 任务 ID。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>项目 ID *</Label>
                <Input
                  value={dispatchForm.projectId}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, projectId: event.target.value }))}
                  placeholder="proj_xuanwu"
                />
              </div>
              <div className="space-y-2">
                <Label>应用 *</Label>
                <Input
                  value={dispatchForm.applicationId}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, applicationId: event.target.value }))}
                  placeholder="portal-web"
                />
              </div>
              <div className="space-y-2">
                <Label>代码分支 *</Label>
                <Input
                  value={dispatchForm.branchName}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, branchName: event.target.value }))}
                  placeholder="feature/awesome-update"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>任务标题 *</Label>
                <Input
                  value={dispatchForm.taskTitle}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskTitle: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select
                  value={dispatchForm.priority}
                  onValueChange={(value) => setDispatchForm((prev) => ({ ...prev, priority: value as AITaskPriority }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">高</SelectItem>
                    <SelectItem value="MEDIUM">中</SelectItem>
                    <SelectItem value="LOW">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>任务描述 *</Label>
              <Textarea
                rows={4}
                value={dispatchForm.taskDescription}
                onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskDescription: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>预期产出</Label>
              <Textarea
                rows={3}
                value={dispatchForm.expectedOutputs}
                onChange={(event) => setDispatchForm((prev) => ({ ...prev, expectedOutputs: event.target.value }))}
                placeholder={['以换行分隔，例如：', '提交 PR', '测试报告'].join('\n')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDispatchDialogOpen(false)}>
              取消
            </Button>
            <Button className="gap-2" onClick={handleDispatch} disabled={dispatchSubmitting}>
              {dispatchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              派发任务
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑 AI 员工信息</DialogTitle>
            <DialogDescription>调整模型配置、状态与能力标签。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>模型提供方 *</Label>
                <Input
                  value={editForm.modelProvider}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, modelProvider: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>模型名称 *</Label>
                <Input
                  value={editForm.modelName}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, modelName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>模型温度</Label>
                <Input
                  value={editForm.temperature}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, temperature: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>最大 Tokens</Label>
                <Input
                  value={editForm.maxTokens}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, maxTokens: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>能力标签</Label>
              <Input
                value={editForm.capabilityTags}
                onChange={(event) => setEditForm((prev) => ({ ...prev, capabilityTags: event.target.value }))}
                placeholder="以逗号分隔"
              />
            </div>
            <div className="space-y-2">
              <Label>员工状态</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value as AIEmployeeStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">启用</SelectItem>
                  <SelectItem value="DISABLED">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>员工简介</Label>
              <Textarea
                rows={4}
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditSubmit} disabled={editSubmitting} className="gap-2">
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
              保存修改
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
