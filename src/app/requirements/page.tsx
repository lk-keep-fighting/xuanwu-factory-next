'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  Filter,
  LayoutList,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Timer,
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  type RequirementFilterOptions,
  type RequirementListItem,
  type RequirementListResponse,
  type RequirementListStats,
  type RequirementPriority,
  type RequirementStatus
} from '@/types/requirement'

import { RequirementDueIndicator } from './components/due-indicator'
import { SimpleMarkdownViewer } from './components/markdown-viewer'
import { RequirementPriorityBadge } from './components/priority-badge'
import { RequirementStatusBadge, requirementStatusMeta } from './components/status-badge'

const STATUS_OPTIONS: RequirementStatus[] = ['DRAFT', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED']
const PRIORITY_OPTIONS: RequirementPriority[] = ['LOW', 'MEDIUM', 'HIGH']

const initialStats: RequirementListStats = {
  total: 0,
  draft: 0,
  todo: 0,
  inProgress: 0,
  done: 0,
  canceled: 0,
  overdue: 0
}

const initialFilters: RequirementFilterOptions = {
  projects: [],
  services: [],
  owners: [],
  watchers: [],
  priorities: PRIORITY_OPTIONS,
  statuses: STATUS_OPTIONS,
  tags: []
}

type CreateRequirementForm = {
  title: string
  description: string
  projectId: string
  serviceIds: string[]
  priority: RequirementPriority
  status: RequirementStatus
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

const getInitialForm = (filters: RequirementFilterOptions): CreateRequirementForm => {
  const defaultProjectId = filters.projects[0]?.id ?? ''
  const defaultOwnerId = filters.owners[0]?.id ?? ''
  const defaultServiceIds = filters.services
    .filter((service) => service.projectId === defaultProjectId)
    .slice(0, 1)
    .map((service) => service.id)

  return {
    title: '',
    description: '## 功能目标\n\n- 描述需求的目标、验收标准与约束条件。\n- 支持在 Markdown 中补充示例、流程图等内容。',
    projectId: defaultProjectId,
    serviceIds: defaultServiceIds,
    priority: 'MEDIUM',
    status: 'DRAFT',
    ownerId: defaultOwnerId,
    watcherIds: [],
    dueAt: '',
    tags: ''
  }
}

const summarizeServices = (services: RequirementListItem['services']) => {
  if (!services || services.length === 0) return '未关联服务'
  if (services.length === 1) return services[0].name
  return `${services[0].name} 等 ${services.length} 个`
}

export default function RequirementListPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RequirementListItem[]>([])
  const [stats, setStats] = useState<RequirementListStats>(initialStats)
  const [filters, setFilters] = useState<RequirementFilterOptions>(initialFilters)
  const [total, setTotal] = useState(0)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchValue, setSearchValue] = useState('')

  const [selectedStatuses, setSelectedStatuses] = useState<RequirementStatus[]>([])
  const [selectedPriorities, setSelectedPriorities] = useState<RequirementPriority[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('ALL')
  const [selectedService, setSelectedService] = useState<string>('ALL')
  const [selectedOwner, setSelectedOwner] = useState<string>('ALL')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [aiDispatchFilter, setAiDispatchFilter] = useState<'ALL' | 'DISPATCHED' | 'UNDISPATCHED'>('ALL')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'dueAt' | 'priority'>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateRequirementForm>(() => getInitialForm(initialFilters))
  const [markdownTab, setMarkdownTab] = useState<'edit' | 'preview'>('edit')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchValue(searchTerm.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchRequirements = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (searchValue) params.set('search', searchValue)
      if (selectedStatuses.length > 0) params.set('status', selectedStatuses.join(','))
      if (selectedPriorities.length > 0) params.set('priority', selectedPriorities.join(','))
      if (selectedProject !== 'ALL') params.set('projectId', selectedProject)
      if (selectedService !== 'ALL') params.set('serviceId', selectedService)
      if (selectedOwner !== 'ALL') params.set('ownerId', selectedOwner)
      if (onlyOverdue) params.set('overdue', 'true')
      if (aiDispatchFilter === 'DISPATCHED') params.set('aiDispatch', 'dispatched')
      if (aiDispatchFilter === 'UNDISPATCHED') params.set('aiDispatch', 'undispatched')
      if (sortBy) params.set('sortBy', sortBy)
      if (sortOrder) params.set('sortOrder', sortOrder)

      const queryString = params.toString()
      const res = await fetch(`/api/requirements${queryString ? `?${queryString}` : ''}`)
      if (!res.ok) {
        throw new Error('加载需求列表失败')
      }
      const data = (await res.json()) as RequirementListResponse
      setItems(Array.isArray(data.items) ? data.items : [])
      setStats(data.stats ?? initialStats)
      setFilters(data.filters ?? initialFilters)
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : '加载需求列表失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [aiDispatchFilter, onlyOverdue, searchValue, selectedOwner, selectedPriorities, selectedProject, selectedService, selectedStatuses, sortBy, sortOrder])

  useEffect(() => {
    fetchRequirements()
  }, [fetchRequirements])

  useEffect(() => {
    // 重置创建表单默认值
    setCreateForm((prev) => {
      if (prev.projectId || filters.projects.length === 0) return prev
      return getInitialForm(filters)
    })
  }, [filters])

  const filteredServices = useMemo(() => {
    if (selectedProject === 'ALL') return filters.services
    return filters.services.filter((service) => service.projectId === selectedProject)
  }, [filters.services, selectedProject])

  const ownerOptions = useMemo(() => filters.owners, [filters.owners])

  const handleStatusToggle = (status: RequirementStatus, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true
    setSelectedStatuses((prev) => {
      if (isChecked) {
        if (prev.includes(status)) return prev
        return [...prev, status]
      }
      return prev.filter((item) => item !== status)
    })
  }

  const handlePriorityToggle = (priority: RequirementPriority, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true
    setSelectedPriorities((prev) => {
      if (isChecked) {
        if (prev.includes(priority)) return prev
        return [...prev, priority]
      }
      return prev.filter((item) => item !== priority)
    })
  }

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId)
    setSelectedService('ALL')
  }

  const resetFilters = () => {
    setSelectedStatuses([])
    setSelectedPriorities([])
    setSelectedProject('ALL')
    setSelectedService('ALL')
    setSelectedOwner('ALL')
    setOnlyOverdue(false)
    setAiDispatchFilter('ALL')
    setSortBy('updatedAt')
    setSortOrder('desc')
    setSearchTerm('')
  }

  const formServices = useMemo(() => {
    if (!createForm.projectId) return filters.services
    return filters.services.filter((service) => service.projectId === createForm.projectId)
  }, [createForm.projectId, filters.services])

  const handleFormProjectChange = (projectId: string) => {
    const nextServices = filters.services
      .filter((service) => service.projectId === projectId)
      .slice(0, 1)
      .map((service) => service.id)
    setCreateForm((prev) => ({ ...prev, projectId, serviceIds: nextServices }))
  }

  const toggleFormService = (serviceId: string, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true
    setCreateForm((prev) => {
      const exists = prev.serviceIds.includes(serviceId)
      if (isChecked && !exists) {
        return { ...prev, serviceIds: [...prev.serviceIds, serviceId] }
      }
      if (!isChecked && exists) {
        return { ...prev, serviceIds: prev.serviceIds.filter((id) => id !== serviceId) }
      }
      return prev
    })
  }

  const toggleFormWatcher = (watcherId: string, checked: boolean | 'indeterminate') => {
    const isChecked = checked === true
    setCreateForm((prev) => {
      const exists = prev.watcherIds.includes(watcherId)
      if (isChecked && !exists) {
        return { ...prev, watcherIds: [...prev.watcherIds, watcherId] }
      }
      if (!isChecked && exists) {
        return { ...prev, watcherIds: prev.watcherIds.filter((id) => id !== watcherId) }
      }
      return prev
    })
  }

  const openCreateDialog = () => {
    setCreateForm(getInitialForm(filters))
    setMarkdownTab('edit')
    setCreateDialogOpen(true)
  }

  const handleCreateRequirement = async () => {
    if (!createForm.title.trim()) {
      toast.error('请输入需求标题')
      return
    }
    if (!createForm.description.trim()) {
      toast.error('请填写需求描述')
      return
    }
    if (!createForm.projectId) {
      toast.error('请选择关联项目')
      return
    }
    if (!createForm.ownerId) {
      toast.error('请选择需求责任人')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          description: createForm.description,
          projectId: createForm.projectId,
          serviceIds: createForm.serviceIds,
          priority: createForm.priority,
          status: createForm.status,
          ownerId: createForm.ownerId,
          watcherIds: createForm.watcherIds,
          dueAt: createForm.dueAt || undefined,
          tags: createForm.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result?.error || '创建需求失败')
      }

      toast.success('需求创建成功')
      setCreateDialogOpen(false)
      await fetchRequirements()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建需求失败'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const statsCards = useMemo(
    () => [
      {
        label: '需求总数',
        value: stats.total,
        icon: <LayoutList className="h-4 w-4 text-primary" />,
        helper: `${stats.todo} 个待执行`
      },
      {
        label: '执行中',
        value: stats.inProgress,
        icon: <Activity className="h-4 w-4 text-sky-600" />,
        helper: `${stats.todo} 个待启动`
      },
      {
        label: '已逾期',
        value: stats.overdue,
        icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
        helper: `${stats.done} 个已完成`
      }
    ],
    [stats.done, stats.inProgress, stats.overdue, stats.todo, stats.total]
  )

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        {statsCards.map((card) => (
          <Card key={card.label} className="border border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-sm font-medium text-gray-500">{card.label}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-semibold text-gray-900">{card.value}</p>
                <span className="text-xs text-gray-400">{card.helper}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="搜索标题、描述或项目"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  状态
                  {selectedStatuses.length > 0 ? <span className="text-primary">({selectedStatuses.length})</span> : null}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel>状态筛选</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filters.statuses.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={(checked) => handleStatusToggle(status, checked)}
                  >
                    {requirementStatusMeta[status]?.label ?? status}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Timer className="h-4 w-4" />
                  优先级
                  {selectedPriorities.length > 0 ? <span className="text-primary">({selectedPriorities.length})</span> : null}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel>优先级筛选</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRIORITY_OPTIONS.map((priority) => (
                  <DropdownMenuCheckboxItem
                    key={priority}
                    checked={selectedPriorities.includes(priority)}
                    onCheckedChange={(checked) => handlePriorityToggle(priority, checked)}
                  >
                    {priority === 'HIGH' ? '高' : priority === 'MEDIUM' ? '中' : '低'}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={onlyOverdue ? 'default' : 'outline'}
              className={cn('gap-2', onlyOverdue ? 'bg-rose-600 text-white hover:bg-rose-600/90' : '')}
              onClick={() => setOnlyOverdue((prev) => !prev)}
            >
              <AlertTriangle className="h-4 w-4" />
              仅看逾期
            </Button>
            <Button variant="ghost" className="gap-2 text-gray-500" onClick={resetFilters}>
              <RefreshCcw className="h-4 w-4" />
              重置
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:items-center">
          <Select value={selectedProject} onValueChange={(value) => handleProjectChange(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部项目</SelectItem>
              {filters.projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedService} onValueChange={(value) => setSelectedService(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择服务" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部服务</SelectItem>
              {filteredServices.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedOwner} onValueChange={(value) => setSelectedOwner(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="责任人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部责任人</SelectItem>
              {ownerOptions.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={aiDispatchFilter} onValueChange={(value) => setAiDispatchFilter(value as typeof aiDispatchFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="派发状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部派发状态</SelectItem>
              <SelectItem value="DISPATCHED">已派发 AI 任务</SelectItem>
              <SelectItem value="UNDISPATCHED">未派发</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortBy}:${sortOrder}`} onValueChange={(value) => {
            const [nextSortBy, nextOrder] = value.split(':') as [typeof sortBy, typeof sortOrder]
            setSortBy(nextSortBy)
            setSortOrder(nextOrder)
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt:desc">按最近更新</SelectItem>
              <SelectItem value="dueAt:asc">按截止日期（最近）</SelectItem>
              <SelectItem value="priority:desc">按优先级（高在前）</SelectItem>
            </SelectContent>
          </Select>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            新建需求
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">需求列表</h2>
            <p className="text-sm text-gray-500">共 {total} 个需求，覆盖 {filters.projects.length} 个项目</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchRequirements}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 数据加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
            <LayoutList className="h-10 w-10" />
            <p className="text-sm">暂无符合条件的需求</p>
            <Button variant="outline" onClick={openCreateDialog}>
              创建第一个需求
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[260px]">需求详情</TableHead>
                <TableHead className="min-w-[180px]">项目 / 服务</TableHead>
                <TableHead className="min-w-[160px]">责任人 / 关注人</TableHead>
                <TableHead className="min-w-[160px]">截止时间</TableHead>
                <TableHead className="min-w-[160px]">进度</TableHead>
                <TableHead className="min-w-[160px]">AI 协同</TableHead>
                <TableHead className="w-14 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/requirements/${item.id}`)}
                >
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                        <RequirementStatusBadge status={item.status} />
                        <RequirementPriorityBadge priority={item.priority} />
                      </div>
                      <p className="line-clamp-2 text-xs text-gray-500">{item.summary}</p>
                      {item.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                              onClick={(event) => event.stopPropagation()}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-gray-600">
                    <div className="space-y-1.5">
                      <div className="font-medium text-gray-900">{item.project.name}</div>
                      <div className="text-xs text-gray-500">{summarizeServices(item.services)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-gray-600">
                    <div className="space-y-1.5">
                      <div className="font-medium text-gray-900">{item.owner.name}</div>
                      {item.watchers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 text-[11px] text-gray-500">
                          {item.watchers.slice(0, 3).map((watcher) => (
                            <span
                              key={watcher.id}
                              className="rounded-full bg-gray-100 px-2 py-0.5"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {watcher.name}
                            </span>
                          ))}
                          {item.watchers.length > 3 ? (
                            <span className="text-gray-400">+{item.watchers.length - 3}</span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">暂无关注人</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-gray-600">
                    <RequirementDueIndicator
                      dueAt={item.dueAt}
                      status={item.status}
                      remainingDays={item.remainingDays}
                      className="mt-1"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-2">
                      <Progress value={item.progressPercentage} />
                      <div className="text-xs text-gray-500">完成度 {item.progressPercentage}%</div>
                      <div
                        className={cn(
                          'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                          item.riskLevel === 'HIGH'
                            ? 'bg-rose-50 text-rose-600'
                            : item.riskLevel === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-emerald-50 text-emerald-600'
                        )}
                      >
                        风险：{item.riskLevel === 'HIGH' ? '高' : item.riskLevel === 'MEDIUM' ? '中' : '低'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-sm text-gray-600">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users className="h-3.5 w-3.5" />
                        <span>已派发 {item.aiTaskCount} 个任务</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        最近派发：{buildRelativeTime(item.lastAiDispatchAt)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-primary"
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push(`/requirements/${item.id}`)
                      }}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>新建需求</DialogTitle>
            <DialogDescription>补充基础信息与需求描述，可选择保存为草稿或直接进入待执行状态。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">需求标题</Label>
                <Input
                  id="title"
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="例如：构建需求管理模块前端原型"
                />
              </div>
              <div className="space-y-2">
                <Label>关联项目</Label>
                <Select
                  value={createForm.projectId}
                  onValueChange={(value) => handleFormProjectChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {filters.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联服务</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {createForm.serviceIds.length > 0
                        ? `已选 ${createForm.serviceIds.length} 个服务`
                        : '选择服务'}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <DropdownMenuLabel>选择服务</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {formServices.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-gray-400">当前项目暂无服务</div>
                    ) : (
                      formServices.map((service) => (
                        <DropdownMenuCheckboxItem
                          key={service.id}
                          checked={createForm.serviceIds.includes(service.id)}
                          onCheckedChange={(checked) => toggleFormService(service.id, checked)}
                        >
                          {service.name}
                        </DropdownMenuCheckboxItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(value) => setCreateForm((prev) => ({ ...prev, priority: value as RequirementPriority }))}
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
                  <Label>初始状态</Label>
                  <Select
                    value={createForm.status}
                    onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value as RequirementStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">草稿</SelectItem>
                      <SelectItem value="TODO">待执行</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>需求责任人</Label>
                <Select
                  value={createForm.ownerId}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, ownerId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择责任人" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关注人</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {createForm.watcherIds.length > 0
                        ? `已选 ${createForm.watcherIds.length} 人`
                        : '选择关注人'}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <DropdownMenuLabel>选择关注人</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ownerOptions.map((owner) => (
                      <DropdownMenuCheckboxItem
                        key={owner.id}
                        checked={createForm.watcherIds.includes(owner.id)}
                        onCheckedChange={(checked) => toggleFormWatcher(owner.id, checked)}
                      >
                        {owner.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {createForm.watcherIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1 text-[11px] text-gray-500">
                    {createForm.watcherIds.map((id) => {
                      const watcher = filters.owners.find((person) => person.id === id)
                      return watcher ? (
                        <span key={id} className="rounded-full bg-gray-100 px-2 py-0.5">
                          {watcher.name}
                        </span>
                      ) : null
                    })}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueAt">截止日期</Label>
                <Input
                  id="dueAt"
                  type="date"
                  value={createForm.dueAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, dueAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">标签（逗号分隔）</Label>
                <Input
                  id="tags"
                  value={createForm.tags}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="例如：AI 协同, 数据治理"
                />
              </div>
            </div>
            <div className="space-y-4">
              <Label>需求描述（Markdown 支持）</Label>
              <Tabs value={markdownTab} onValueChange={(value) => setMarkdownTab(value as 'edit' | 'preview')}>
                <TabsList>
                  <TabsTrigger value="edit">编辑</TabsTrigger>
                  <TabsTrigger value="preview">预览</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="mt-2">
                  <Textarea
                    value={createForm.description}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="h-[320px] resize-none"
                    placeholder="使用 Markdown 编写需求详情"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <div className="h-[320px] overflow-y-auto rounded border border-gray-200 bg-gray-50 p-4">
                    <SimpleMarkdownViewer content={createForm.description} />
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleCreateRequirement} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  创建需求
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
