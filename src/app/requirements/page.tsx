'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Plus, RefreshCcw, Search } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import {
  type RequirementFilterOptions,
  type RequirementListItem,
  type RequirementListResponse
} from '@/types/requirement'

const initialFilters: RequirementFilterOptions = {
  projects: [],
  services: []
}

type CreateRequirementForm = {
  title: string
  projectId: string
  serviceIds: string[]
}

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

const getInitialForm = (filters: RequirementFilterOptions): CreateRequirementForm => {
  const defaultProject = filters.projects[0]?.id ?? ''
  const defaultServiceIds = filters.services
    .filter((service) => service.projectId === defaultProject)
    .slice(0, 1)
    .map((service) => service.id)

  return {
    title: '',
    projectId: defaultProject,
    serviceIds: defaultServiceIds
  }
}

export default function RequirementListPage() {
  const router = useRouter()

  const [items, setItems] = useState<RequirementListItem[]>([])
  const [filters, setFilters] = useState<RequirementFilterOptions>(initialFilters)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [searchTerm, setSearchTerm] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('ALL')
  const [selectedService, setSelectedService] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'title'>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateRequirementForm>(() => getInitialForm(initialFilters))
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
      if (selectedProject !== 'ALL') params.set('projectId', selectedProject)
      if (selectedService !== 'ALL') params.set('serviceId', selectedService)
      if (sortBy) params.set('sortBy', sortBy)
      if (sortOrder) params.set('sortOrder', sortOrder)

      const res = await fetch(`/api/requirements${params.size > 0 ? `?${params.toString()}` : ''}`)
      if (!res.ok) {
        throw new Error('加载需求列表失败')
      }

      const data = (await res.json()) as RequirementListResponse
      setItems(Array.isArray(data.items) ? data.items : [])
      setFilters(data.filters ?? initialFilters)
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '加载需求列表失败'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [searchValue, selectedProject, selectedService, sortBy, sortOrder])

  useEffect(() => {
    fetchRequirements()
  }, [fetchRequirements])

  useEffect(() => {
    setCreateForm((prev) => {
      if (prev.projectId || filters.projects.length === 0) return prev
      return getInitialForm(filters)
    })
  }, [filters])

  const filteredServices = useMemo(() => {
    if (selectedProject === 'ALL') return filters.services
    return filters.services.filter((service) => service.projectId === selectedProject)
  }, [filters.services, selectedProject])

  const formServices = useMemo(() => {
    if (!createForm.projectId) return filters.services
    return filters.services.filter((service) => service.projectId === createForm.projectId)
  }, [createForm.projectId, filters.services])

  const openCreateDialog = () => {
    setCreateForm(getInitialForm(filters))
    setCreateDialogOpen(true)
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

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId)
    setSelectedService('ALL')
  }

  const handleFormProjectChange = (projectId: string) => {
    const nextServiceIds = filters.services
      .filter((service) => service.projectId === projectId)
      .slice(0, 1)
      .map((service) => service.id)
    setCreateForm((prev) => ({ ...prev, projectId, serviceIds: nextServiceIds }))
  }

  const handleCreateRequirement = async () => {
    if (!createForm.title.trim()) {
      toast.error('请输入需求标题')
      return
    }
    if (!createForm.projectId) {
      toast.error('请选择关联项目')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          projectId: createForm.projectId,
          serviceIds: createForm.serviceIds
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result?.error || '创建需求失败')
      }

      toast.success('需求已创建')
      setCreateDialogOpen(false)
      await fetchRequirements()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '创建需求失败'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedProject('ALL')
    setSelectedService('ALL')
    setSortBy('updatedAt')
    setSortOrder('desc')
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">需求列表</h1>
          <p className="text-sm text-gray-500">当前共有 {total} 条需求，可快速派发任务给 AI 员工</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          新建需求
        </Button>
      </section>

      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="搜索需求标题或项目"
              className="pl-9"
            />
          </div>
          <Button variant="ghost" className="gap-2 text-gray-500" onClick={resetFilters}>
            <RefreshCcw className="h-4 w-4" />
            重置
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 md:items-center">
          <Select value={selectedProject} onValueChange={handleProjectChange}>
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
          <Select value={`${sortBy}:${sortOrder}`} onValueChange={(value) => {
            const [nextSortBy, nextOrder] = value.split(':') as [typeof sortBy, typeof sortOrder]
            setSortBy(nextSortBy)
            setSortOrder(nextOrder)
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt:desc">按更新时间（最新优先）</SelectItem>
              <SelectItem value="updatedAt:asc">按更新时间（最早优先）</SelectItem>
              <SelectItem value="title:asc">按标题（A-Z）</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Card className="border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 py-4">
          <CardTitle className="text-lg font-semibold text-gray-900">需求概览</CardTitle>
          <Button variant="outline" size="icon" onClick={fetchRequirements}>
            {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> 数据加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
              <p className="text-sm">暂无需求</p>
              <Button variant="outline" onClick={openCreateDialog}>
                新建第一条需求
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">需求标题</TableHead>
                  <TableHead className="w-1/5">关联项目</TableHead>
                  <TableHead className="w-1/4">关联服务</TableHead>
                  <TableHead className="w-1/6">AI 任务</TableHead>
                  <TableHead className="w-[140px]">最近更新</TableHead>
                  <TableHead className="w-14 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/requirements/${item.id}`)}>
                    <TableCell className="align-top">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{item.title}</span>
                        <span className="text-xs text-gray-400">创建于 {formatDateTime(item.createdAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-gray-600">
                      {item.project.name}
                    </TableCell>
                    <TableCell className="align-top text-sm text-gray-600">
                      {item.services.length === 0
                        ? '未关联服务'
                        : item.services.map((service) => service.name).join('、')}
                    </TableCell>
                    <TableCell className="align-top text-sm text-gray-600">
                      <div className="flex flex-col text-xs">
                        <span>已派发 {item.aiTaskCount} 个任务</span>
                        <span className="text-gray-400">{buildRelativeTime(item.lastAiDispatchAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-xs text-gray-500">
                      {buildRelativeTime(item.updatedAt)}
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
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>新建需求</DialogTitle>
            <DialogDescription>填写需求标题并选择关联的项目与服务，即可在详情页派发任务给 AI 员工。</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-gray-700">
                需求标题
              </label>
              <Input
                id="title"
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="例如：整理计费项目需求池"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">关联项目</label>
              <Select value={createForm.projectId} onValueChange={handleFormProjectChange}>
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
              <label className="text-sm font-medium text-gray-700">关联服务</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {createForm.serviceIds.length > 0 ? `已选择 ${createForm.serviceIds.length} 个服务` : '选择服务'}
                    <span className="text-xs text-gray-400">点击展开</span>
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
              <p className="text-xs text-gray-400">至少选择一个服务，便于 AI 任务带上执行上下文。</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreateRequirement} disabled={creating} className={cn('gap-2')}>
                {creating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                创建需求
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
