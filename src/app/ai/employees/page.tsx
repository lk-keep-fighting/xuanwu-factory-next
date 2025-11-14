'use client'

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  BarChart2,
  CheckSquare,
  Edit3,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Send,
  Sparkles,
  UserCheck,
  Users
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AIEmployeeListItem,
  AIEmployeeStatus,
  AIEmployeeType,
  AIRoleTemplateListItem,
  AITaskPriority
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

const TYPE_LABEL: Record<AIEmployeeType, string> = {
  ENGINEER: '研发人员',
  QA: '测试人员'
}

const STATUS_STYLE: Record<AIEmployeeStatus, { label: string; className: string }> = {
  ACTIVE: { label: '已启用', className: 'bg-emerald-50 text-emerald-600 border border-emerald-200' },
  DISABLED: { label: '已停用', className: 'bg-gray-100 text-gray-500 border border-gray-200' }
}

type EmployeeFormState = {
  name: string
  type: AIEmployeeType
  roleTemplateId: string
  modelProvider: string
  modelName: string
  temperature: string
  maxTokens: string
  capabilityTags: string
  description: string
  status: AIEmployeeStatus
}

type EmployeesMeta = {
  totalEmployees: number
  activeEmployees: number
  tasksThisWeek: number
  typeDistribution: Record<AIEmployeeType, number>
}

const initialFormState: EmployeeFormState = {
  name: '',
  type: 'ENGINEER',
  roleTemplateId: '',
  modelProvider: '',
  modelName: '',
  temperature: '0.3',
  maxTokens: '3000',
  capabilityTags: '',
  description: '',
  status: 'ACTIVE'
}

const initialDispatchForm = {
  projectId: '',
  applicationId: '',
  branchName: '',
  taskTitle: '',
  taskDescription: '',
  expectedOutputs: '',
  priority: 'MEDIUM' as AITaskPriority
}

const formatRelativeTime = (dateString?: string) => {
  if (!dateString) return '暂无记录'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
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

const parseCapabilityTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)

export default function AiEmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<AIEmployeeListItem[]>([])
  const [meta, setMeta] = useState<EmployeesMeta>({
    totalEmployees: 0,
    activeEmployees: 0,
    tasksThisWeek: 0,
    typeDistribution: { ENGINEER: 0, QA: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<'ALL' | AIEmployeeType>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | AIEmployeeStatus>('ALL')
  const [sortBy, setSortBy] = useState<'tasks' | 'lastTask' | 'default'>('default')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [templates, setTemplates] = useState<AIRoleTemplateListItem[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false)

  const [createForm, setCreateForm] = useState<EmployeeFormState>(initialFormState)
  const [editForm, setEditForm] = useState<EmployeeFormState>(initialFormState)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)

  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false)

  const [dispatchForm, setDispatchForm] = useState(initialDispatchForm)

  const typeOptions = useMemo(
    () => [
      { label: '全部类型', value: 'ALL' },
      { label: '研发人员', value: 'ENGINEER' },
      { label: '测试人员', value: 'QA' }
    ],
    []
  )

  const statusOptions = useMemo(
    () => [
      { label: '全部状态', value: 'ALL' },
      { label: '已启用', value: 'ACTIVE' },
      { label: '已停用', value: 'DISABLED' }
    ],
    []
  )

  const sortOptions = useMemo(
    () => [
      { label: '默认排序', value: 'default' },
      { label: '按执行任务数', value: 'tasks' },
      { label: '按最近任务时间', value: 'lastTask' }
    ],
    []
  )

  const refreshEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedType !== 'ALL') params.set('type', selectedType)
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus)
      if (sortBy !== 'default') params.set('sortBy', sortBy)
      if (searchKeyword) params.set('search', searchKeyword)

      const query = params.toString()
      const res = await fetch(`/api/ai/employees${query ? `?${query}` : ''}`)
      if (!res.ok) {
        throw new Error('加载 AI 员工列表失败')
      }
      const data = await res.json()
      setEmployees(Array.isArray(data?.data) ? data.data : [])
      if (data?.meta) {
        setMeta((prev) => ({
          ...prev,
          ...data.meta,
          typeDistribution: data.meta.typeDistribution ?? { ENGINEER: 0, QA: 0 }
        }))
      }
      setSelectedIds((prev) => prev.filter((id) => (data?.data ?? []).some((item: AIEmployeeListItem) => item.id === id)))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载 AI 员工失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [searchKeyword, selectedStatus, selectedType, sortBy])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchKeyword(searchTerm.trim())
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    refreshEmployees()
  }, [refreshEmployees])

  const loadTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true)
      const res = await fetch('/api/ai/role-templates')
      if (!res.ok) {
        throw new Error('加载角色模板失败')
      }
      const data = await res.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载角色模板失败'
      toast.error(message)
    } finally {
      setLoadingTemplates(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (!createDialogOpen) {
      resetCreateForm()
    }
  }, [createDialogOpen])

  useEffect(() => {
    if (!editDialogOpen) {
      setEditingEmployeeId(null)
      setEditForm(initialFormState)
    }
  }, [editDialogOpen])

  const resetCreateForm = () => {
    setCreateForm(initialFormState)
  }

  const resetDispatchForm = () => {
    setDispatchForm(initialDispatchForm)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(employees.map((employee) => employee.id))
    } else {
      setSelectedIds([])
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const openCreateDialog = () => {
    if (templates.length === 0) {
      toast.warning('请先创建角色模板')
      return
    }
    resetCreateForm()
    setCreateDialogOpen(true)
  }

  const openEditDialog = (employee: AIEmployeeListItem) => {
    setEditingEmployeeId(employee.id)
    setEditForm({
      name: employee.name,
      type: employee.type,
      roleTemplateId: employee.roleTemplateId,
      modelProvider: employee.modelProvider,
      modelName: employee.modelName,
      temperature: String(employee.modelParams.temperature ?? 0.3),
      maxTokens: String(employee.modelParams.maxTokens ?? 2048),
      capabilityTags: employee.capabilityTags.join(', '),
      description: employee.description ?? '',
      status: employee.status
    })
    setEditDialogOpen(true)
  }

  const validateForm = (form: EmployeeFormState) => {
    if (!form.name.trim()) return '请填写 AI 员工名称'
    if (!form.roleTemplateId) return '请选择关联的角色模板'
    if (!form.modelProvider.trim() || !form.modelName.trim()) return '请补充模型提供方与模型名称'
    const temperature = Number.parseFloat(form.temperature)
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 1) return '模型温度需在 0-1 之间'
    const maxTokens = Number.parseInt(form.maxTokens, 10)
    if (Number.isNaN(maxTokens) || maxTokens <= 0) return '最大 Tokens 需为正整数'
    return null
  }

  const handleCreateEmployee = async () => {
    const errorMsg = validateForm(createForm)
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }

    setCreateSubmitting(true)
    try {
      const response = await fetch('/api/ai/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          type: createForm.type,
          roleTemplateId: createForm.roleTemplateId,
          modelProvider: createForm.modelProvider.trim(),
          modelName: createForm.modelName.trim(),
          modelParams: {
            temperature: Number.parseFloat(createForm.temperature),
            maxTokens: Number.parseInt(createForm.maxTokens, 10)
          },
          capabilityTags: parseCapabilityTags(createForm.capabilityTags),
          description: createForm.description.trim() || null,
          status: createForm.status
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || '创建失败')
      }

      toast.success('AI 员工创建成功')
      setCreateDialogOpen(false)
      resetCreateForm()
      await refreshEmployees()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建 AI 员工失败'
      toast.error(message)
    } finally {
      setCreateSubmitting(false)
    }
  }

  const handleUpdateEmployee = async () => {
    if (!editingEmployeeId) return
    const errorMsg = validateForm(editForm)
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }

    setEditSubmitting(true)
    try {
      const response = await fetch(`/api/ai/employees/${editingEmployeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          type: editForm.type,
          roleTemplateId: editForm.roleTemplateId,
          modelProvider: editForm.modelProvider.trim(),
          modelName: editForm.modelName.trim(),
          modelParams: {
            temperature: Number.parseFloat(editForm.temperature),
            maxTokens: Number.parseInt(editForm.maxTokens, 10)
          },
          capabilityTags: parseCapabilityTags(editForm.capabilityTags),
          description: editForm.description.trim() || null,
          status: editForm.status
        })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || '更新失败')
      }

      toast.success('AI 员工信息已更新')
      setEditDialogOpen(false)
      setEditingEmployeeId(null)
      await refreshEmployees()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '更新 AI 员工失败'
      toast.error(message)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleToggleStatus = async (employee: AIEmployeeListItem) => {
    const nextStatus: AIEmployeeStatus = employee.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
    try {
      const response = await fetch(`/api/ai/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || '状态更新失败')
      }
      toast.success(`员工已${nextStatus === 'ACTIVE' ? '启用' : '停用'}`)
      await refreshEmployees()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '切换状态失败')
    }
  }

  const handleDispatchTasks = async () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择至少一位 AI 员工')
      return
    }
    if (!dispatchForm.projectId || !dispatchForm.applicationId || !dispatchForm.branchName) {
      toast.error('请完善任务上下文信息')
      return
    }
    if (!dispatchForm.taskTitle.trim() || !dispatchForm.taskDescription.trim()) {
      toast.error('请填写任务标题与详情')
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

      const responses = await Promise.all(
        selectedIds.map(async (employeeId) => {
          const res = await fetch(`/api/ai/employees/${employeeId}/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          const result = await res.json()
          if (!res.ok) {
            throw new Error(result?.error || '任务派发失败')
          }
          return result
        })
      )

      const taskIds = responses.map((item) => item.taskId).join('，')
      toast.success(`任务已派发：${taskIds}`)
      setDispatchDialogOpen(false)
      resetDispatchForm()
      setSelectedIds([])
      await refreshEmployees()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '任务派发失败')
    } finally {
      setDispatchSubmitting(false)
    }
  }

  const applyTemplateDefaults = (setter: Dispatch<SetStateAction<EmployeeFormState>>) => (templateId: string) => {
    setter((prev) => {
      const template = templates.find((item) => item.id === templateId)
      if (!template) {
        return { ...prev, roleTemplateId: templateId }
      }
      return {
        ...prev,
        roleTemplateId: templateId,
        modelProvider: template.defaultModelProvider,
        modelName: template.defaultModelName,
        temperature: String(template.defaultModelParams.temperature ?? 0.3),
        maxTokens: String(template.defaultModelParams.maxTokens ?? 2048)
      }
    })
  }

  const selectedEmployeesForDispatch = employees.filter((employee) => selectedIds.includes(employee.id))

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">AI 员工总数</CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-gray-900">{meta.totalEmployees}</p>
            <p className="text-sm text-gray-500 mt-1">研发 {meta.typeDistribution.ENGINEER ?? 0} · 测试 {meta.typeDistribution.QA ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">活跃员工</CardTitle>
            <BadgeCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-gray-900">{meta.activeEmployees}</p>
            <p className="text-sm text-gray-500 mt-1">可即时派发任务的 AI 员工</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">本周新任务</CardTitle>
            <Sparkles className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-gray-900">{meta.tasksThisWeek}</p>
            <p className="text-sm text-gray-500 mt-1">已通过 Mock 派发的任务总数</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="搜索员工或技能标签"
                className="pl-9"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as 'ALL' | AIEmployeeType)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as 'ALL' | AIEmployeeStatus)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'tasks' | 'lastTask' | 'default')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={selectedIds.length === 0}
              onClick={() => setDispatchDialogOpen(true)}
            >
              <Send className="h-4 w-4" />
              派发任务
              {selectedIds.length > 0 ? (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {selectedIds.length}
                </span>
              ) : null}
            </Button>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              新增 AI 员工
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 text-center text-gray-400">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
              正在加载 AI 员工数据...
            </div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <UserCheck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p>目前还没有 AI 员工，请先创建一个。</p>
              <div className="mt-4 flex justify-center">
                <Button onClick={openCreateDialog} className="gap-2">
                  <Plus className="h-4 w-4" /> 创建 AI 员工
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-12">
                    <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-gray-500">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={selectedIds.length > 0 && selectedIds.length === employees.length}
                        onChange={(event) => handleSelectAll(event.target.checked)}
                      />
                    </label>
                  </TableHead>
                  <TableHead className="min-w-[160px]">员工</TableHead>
                  <TableHead className="w-28">类型</TableHead>
                  <TableHead className="w-52">关联模板</TableHead>
                  <TableHead>能力标签</TableHead>
                  <TableHead className="w-32">累计任务</TableHead>
                  <TableHead className="w-36">最近任务</TableHead>
                  <TableHead className="w-28">状态</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const statusStyle = STATUS_STYLE[employee.status]
                  return (
                    <TableRow key={employee.id} className="hover:bg-gray-50/80">
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={selectedIds.includes(employee.id)}
                          onChange={() => toggleSelect(employee.id)}
                          aria-label={`选择 ${employee.name}`}
                        />
                      </TableCell>
                      <TableCell className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{employee.name}</span>
                          {employee.status === 'ACTIVE' ? (
                            <BadgeCheck className="h-4 w-4 text-emerald-500" />
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500">模型：{employee.modelProvider} / {employee.modelName}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                          {TYPE_LABEL[employee.type]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link
                          href="/ai/role-templates"
                          className="text-sm text-primary hover:underline"
                        >
                          {employee.roleTemplate.name}
                        </Link>
                        <div className="text-xs text-gray-400">
                          匹配类型：
                          {employee.roleTemplate.applicableType === 'ALL'
                            ? '全部类型'
                            : TYPE_LABEL[employee.roleTemplate.applicableType]}
                        </div>
                      </TableCell>
                      <TableCell className="space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {employee.capabilityTags.length === 0
                            ? <span className="text-xs text-gray-400">未设置</span>
                            : employee.capabilityTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                                >
                                  {tag}
                                </span>
                              ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-gray-900">{employee.totalTaskCount}</div>
                        <div className="text-xs text-gray-500">累计派发任务</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-700">{formatRelativeTime(employee.lastTaskAt)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', statusStyle.className)}>
                          {statusStyle.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/ai/employees/${employee.id}`)}>
                              <BarChart2 className="mr-2 h-4 w-4" /> 查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedIds([employee.id])
                                setDispatchDialogOpen(true)
                              }}
                            >
                              <Send className="mr-2 h-4 w-4" /> 派发任务
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(employee)}>
                              <Edit3 className="mr-2 h-4 w-4" /> 编辑信息
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(employee)}>
                              <CheckSquare className="mr-2 h-4 w-4" />
                              {employee.status === 'ACTIVE' ? '停用员工' : '启用员工'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 创建员工弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>新增 AI 员工</DialogTitle>
            <DialogDescription>配置基础信息、关联角色模板并设置默认模型参数。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>员工名称 *</Label>
                <Input
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="例如：前端体验官"
                />
              </div>
              <div className="space-y-2">
                <Label>员工类型 *</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, type: value as AIEmployeeType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions
                      .filter((option) => option.value !== 'ALL')
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>角色模板 *</Label>
                <Select
                  value={createForm.roleTemplateId}
                  onValueChange={applyTemplateDefaults(setCreateForm)}
                  disabled={loadingTemplates}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTemplates ? '加载模板中...' : '请选择角色模板'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.roleTemplateId ? (
                  <p className="text-xs text-gray-500">
                    模板默认模型：{
                      templates.find((item) => item.id === createForm.roleTemplateId)?.defaultModelProvider
                    }
                    /
                    {
                      templates.find((item) => item.id === createForm.roleTemplateId)?.defaultModelName
                    }
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>能力标签</Label>
                <Input
                  value={createForm.capabilityTags}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, capabilityTags: event.target.value }))}
                  placeholder="以逗号分隔的技能标签"
                />
                <p className="text-xs text-gray-400">示例：前端重构, UI 优化, Storybook</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>模型提供方 *</Label>
                <Input
                  value={createForm.modelProvider}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, modelProvider: event.target.value }))}
                  placeholder="例如：openai"
                />
              </div>
              <div className="space-y-2">
                <Label>模型名称 *</Label>
                <Input
                  value={createForm.modelName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, modelName: event.target.value }))}
                  placeholder="例如：gpt-4o"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>温度</Label>
                  <Input
                    value={createForm.temperature}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, temperature: event.target.value }))}
                    placeholder="0.3"
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大 Tokens</Label>
                  <Input
                    value={createForm.maxTokens}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, maxTokens: event.target.value }))}
                    placeholder="2048"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>员工状态</Label>
                <Select
                  value={createForm.status}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value as AIEmployeeStatus }))}
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
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="用于描述该 AI 员工擅长的任务与注意事项"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateEmployee} disabled={createSubmitting} className="gap-2">
              {createSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑员工弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑 AI 员工信息</DialogTitle>
            <DialogDescription>调整员工模型配置、角色模板或状态。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>员工名称 *</Label>
                <Input
                  value={editForm.name}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>员工类型 *</Label>
                <Select
                  value={editForm.type}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, type: value as AIEmployeeType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions
                      .filter((option) => option.value !== 'ALL')
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>角色模板 *</Label>
                <Select
                  value={editForm.roleTemplateId}
                  onValueChange={(value) => setEditForm((prev) => ({ ...prev, roleTemplateId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>能力标签</Label>
                <Input
                  value={editForm.capabilityTags}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, capabilityTags: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>温度</Label>
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
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={editSubmitting} className="gap-2">
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              保存更改
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 派发任务弹窗 */}
      <Dialog open={dispatchDialogOpen} onOpenChange={(open) => {
        setDispatchDialogOpen(open)
        if (!open) {
          resetDispatchForm()
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>派发任务给 AI 员工</DialogTitle>
            <DialogDescription>建立任务上下文并提交 Mock 派发请求，系统将返回任务占位 ID。</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-primary">
              <p>
                已选择 <strong>{selectedEmployeesForDispatch.length}</strong> 位 AI 员工：
                {selectedEmployeesForDispatch.map((employee) => employee.name).join('，') || '暂无'}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>项目 ID *</Label>
                <Input
                  value={dispatchForm.projectId}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, projectId: event.target.value }))}
                  placeholder="例如：proj_xuanwu"
                />
              </div>
              <div className="space-y-2">
                <Label>应用/服务 *</Label>
                <Input
                  value={dispatchForm.applicationId}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, applicationId: event.target.value }))}
                  placeholder="例如：portal-web"
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
              <Label>任务标题 *</Label>
              <Input
                value={dispatchForm.taskTitle}
                onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskTitle: event.target.value }))}
                placeholder="简要描述要执行的任务"
              />
            </div>
            <div className="space-y-2">
              <Label>任务描述 *</Label>
              <Textarea
                rows={4}
                value={dispatchForm.taskDescription}
                onChange={(event) => setDispatchForm((prev) => ({ ...prev, taskDescription: event.target.value }))}
                placeholder="详细说明任务背景、执行要求与验收标准"
              />
            </div>
            <div className="space-y-2">
              <Label>预期产出</Label>
              <Textarea
                rows={3}
                value={dispatchForm.expectedOutputs}
                onChange={(event) => setDispatchForm((prev) => ({ ...prev, expectedOutputs: event.target.value }))}
                placeholder={['可多行输入，例如：', '• Pull Request', '• 测试报告'].join('\n')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setDispatchDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleDispatchTasks} disabled={dispatchSubmitting} className="gap-2">
              {dispatchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              派发任务
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
