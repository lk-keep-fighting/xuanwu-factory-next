'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, MoreVertical, Pencil, Trash2, Sparkles, Search, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import type { Project } from '@/types/project'

type ProjectFormState = {
  name: string
  identifier: string
  description: string
}

const IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

const sanitizeIdentifierInput = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '')
    .slice(0, 63)

const initialFormState: ProjectFormState = {
  name: '',
  identifier: '',
  description: ''
}

const SORT_OPTIONS = [
  { value: 'created_desc', label: '按创建时间（最新优先）', sortBy: 'created_at', sortOrder: 'desc' },
  { value: 'created_asc', label: '按创建时间（最早优先）', sortBy: 'created_at', sortOrder: 'asc' },
  { value: 'name_asc', label: '按名称（A-Z）', sortBy: 'name', sortOrder: 'asc' },
  { value: 'name_desc', label: '按名称（Z-A）', sortBy: 'name', sortOrder: 'desc' }
] as const

type SortOptionValue = (typeof SORT_OPTIONS)[number]['value']

type ProjectFormType = 'create' | 'edit'

const validateProjectForm = (form: ProjectFormState): string | null => {
  if (!form.name.trim()) {
    return '请输入项目名称'
  }

  if (!form.identifier.trim()) {
    return '请输入项目编号'
  }

  if (!IDENTIFIER_PATTERN.test(form.identifier.trim())) {
    return '项目编号需由小写字母、数字或中划线组成，且不能以中划线开头或结尾'
  }

  return null
}

const formatDateTime = (dateString?: string) => {
  if (!dateString) return '--'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '--'

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const formatRelativeTime = (dateString?: string) => {
  if (!dateString) return '暂无记录'

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '暂无记录'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

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

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : '未知错误'

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState<ProjectFormState>(initialFormState)
  const [editForm, setEditForm] = useState<ProjectFormState>(initialFormState)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [sortOption, setSortOption] = useState<SortOptionValue>('created_desc')

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchValue(searchTerm.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      const sortConfig = SORT_OPTIONS.find((option) => option.value === sortOption) ?? SORT_OPTIONS[0]
      params.set('sortBy', sortConfig.sortBy)
      params.set('sortOrder', sortConfig.sortOrder)
      if (searchValue) {
        params.set('search', searchValue)
      }

      const queryString = params.toString()
      const res = await fetch(`/api/projects${queryString ? `?${queryString}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      toast.error(`加载项目失败：${getErrorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }, [searchValue, sortOption])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const resetForm = (type: ProjectFormType) => {
    if (type === 'create') {
      setCreateForm(initialFormState)
    } else {
      setEditForm(initialFormState)
      setEditingProjectId(null)
    }
  }

  const handleCreateProject = async () => {
    const validationError = validateProjectForm(createForm)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          identifier: createForm.identifier.trim(),
          description: createForm.description.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || '创建项目失败')
      }

      toast.success('项目创建成功')
      
      // 显示 K8s 警告（如果有）
      if (result?.warning) {
        toast.warning(result.warning, { duration: 5000 })
      }
      
      setIsCreateDialogOpen(false)
      resetForm('create')
      await loadProjects()
    } catch (error: unknown) {
      toast.error(`创建失败：${getErrorMessage(error)}`)
    } finally {
      setCreating(false)
    }
  }

  const openEditDialog = (project: Project) => {
    if (!project.id) return
    setEditingProjectId(project.id)
    setEditForm({
      name: project.name,
      identifier: project.identifier,
      description: project.description || ''
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateProject = async () => {
    if (!editingProjectId) return

    const validationError = validateProjectForm(editForm)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setUpdating(true)
    try {
      const response = await fetch(`/api/projects/${editingProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          identifier: editForm.identifier.trim(),
          description: editForm.description.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || '更新项目失败')
      }

      toast.success('项目更新成功')
      setIsEditDialogOpen(false)
      resetForm('edit')
      await loadProjects()
    } catch (error: unknown) {
      toast.error(`更新失败：${getErrorMessage(error)}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteProject = async (project: Project) => {
    if (!project.id) return
    if (!confirm(`确定要删除项目「${project.name}」吗？此操作不可恢复。`)) return

    setDeletingId(project.id)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result?.error || '删除项目失败')
      }

      toast.success('项目已删除')
      await loadProjects()
    } catch (error: unknown) {
      toast.error(`删除失败：${getErrorMessage(error)}`)
    } finally {
      setDeletingId(null)
    }
  }

  const hasActiveSearch = searchValue !== ''

  const projectStats = useMemo(() => {
    const totals = projects.reduce(
      (acc, project) => {
        acc.totalServices += project._count?.services ?? 0
        acc.totalRequirements += project._count?.requirements ?? 0
        return acc
      },
      { totalServices: 0, totalRequirements: 0 }
    )

    return {
      totalProjects: projects.length,
      ...totals
    }
  }, [projects])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-gray-900">项目管理</h1>
            <div className="flex items-center gap-2">
              {/* <Button asChild variant="outline" className="gap-2">
                <Link href="/ai/employees">
                  <Sparkles className="h-4 w-4" />
                  AI 员工模块
                </Link>
              </Button> */}
              {/* <Button asChild variant="outline" className="gap-2">
                <Link href="/requirements">
                  <ClipboardList className="h-4 w-4" />
                  需求管理模块
                </Link>
              </Button> */}
              <Button asChild variant="outline">
                <Link href="/settings">系统配置</Link>
              </Button>
              <Button
                onClick={() => {
                  resetForm('create')
                  setIsCreateDialogOpen(true)
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                新建项目
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜索项目名称或编号"
                className="pl-9"
              />
            </div>
            <div className="flex w-full md:w-auto">
              <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOptionValue)}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="选择排序方式" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {!loading && projects.length > 0 && (
          <div className="grid gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>项目总数</CardDescription>
                <CardTitle className="text-3xl">{projectStats.totalProjects}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-gray-500">
                当前系统中的项目数量
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>服务总数</CardDescription>
                <CardTitle className="text-3xl">{projectStats.totalServices}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-gray-500">
                所有关联项目下的服务实例数量
              </CardContent>
            </Card>
            {/* <Card>
              <CardHeader className="pb-2">
                <CardDescription>关联需求</CardDescription>
                <CardTitle className="text-3xl">{projectStats.totalRequirements}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-gray-500">
                需求管理模块中与项目关联的需求条目
              </CardContent>
            </Card> */}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : projects.length === 0 ? (
          hasActiveSearch ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-3">
                <Search className="w-16 h-16 text-gray-300 mx-auto" />
                <p className="text-gray-500">未找到匹配的项目</p>
                <p className="text-sm text-gray-400">请尝试调整搜索关键词或排序方式</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">暂无项目</p>
                <Button
                  onClick={() => {
                    resetForm('create')
                    setIsCreateDialogOpen(true)
                  }}
                >
                  创建第一个项目
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">项目</TableHead>
                    <TableHead className="min-w-[220px]">描述</TableHead>
                    <TableHead className="w-32">服务数量</TableHead>
                    {/* <TableHead className="w-32">关联需求</TableHead> */}
                    <TableHead className="w-48">创建时间</TableHead>
                    <TableHead className="w-48">最近更新</TableHead>
                    <TableHead className="min-w-[180px] text-right">常规操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const serviceCount = project._count?.services ?? 0
                    const requirementCount = project._count?.requirements ?? 0

                    return (
                      <TableRow
                        key={project.id ?? project.identifier}
                        className={project.id ? 'cursor-pointer' : undefined}
                        onClick={() => project.id && router.push(`/projects/${project.id}`)}
                      >
                        <TableCell className="align-top py-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900">{project.name}</p>
                              <Badge variant="outline" className="font-mono text-xs tracking-wide text-gray-600">
                                {project.identifier}
                              </Badge>
                            </div>
                            {/* <p className="text-xs text-gray-500">
                              ID：{project.id ?? '未生成'}
                            </p> */}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xl whitespace-normal text-sm text-gray-600">
                          {project.description || '暂无描述'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-gray-900">{serviceCount}</span>
                            <span className="text-xs text-gray-500">服务</span>
                          </div>
                        </TableCell>
                        {/* <TableCell>
                          <div className="flex flex-col">
                            <span className="text-base font-semibold text-gray-900">{requirementCount}</span>
                            <span className="text-xs text-gray-500">需求</span>
                          </div>
                        </TableCell> */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{formatDateTime(project.created_at)}</span>
                            <span className="text-xs text-gray-500">{formatRelativeTime(project.created_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{formatRelativeTime(project.updated_at)}</span>
                            <span className="text-xs text-gray-500">{formatDateTime(project.updated_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation()
                                if (project.id) {
                                  router.push(`/projects/${project.id}`)
                                }
                              }}
                            >
                              进入详情
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                                <DropdownMenuItem onClick={() => openEditDialog(project)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  disabled={deletingId === project.id}
                                  onClick={() => handleDeleteProject(project)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) {
            resetForm('create')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称 *</Label>
              <Input
                value={createForm.name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="输入项目名称"
              />
            </div>
            <div className="space-y-2">
              <Label>项目编号 *</Label>
              <Input
                value={createForm.identifier}
                onChange={(e) => setCreateForm((prev) => ({
                  ...prev,
                  identifier: sanitizeIdentifierInput(e.target.value)
                }))}
                placeholder="例如：xuanwu-app"
              />
              <p className="text-xs text-gray-500">仅支持小写字母、数字和中划线，长度 1-63 位</p>
            </div>
            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea
                value={createForm.description}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="输入项目描述"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  resetForm('create')
                }}
              >
                取消
              </Button>
              <Button onClick={handleCreateProject} disabled={creating}>
                {creating ? '创建中...' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            resetForm('edit')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑项目信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称 *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="输入项目名称"
              />
            </div>
            <div className="space-y-2">
              <Label>项目编号 *</Label>
              <Input
                value={editForm.identifier}
                onChange={(e) => setEditForm((prev) => ({
                  ...prev,
                  identifier: sanitizeIdentifierInput(e.target.value)
                }))}
                placeholder="用于访问的唯一二级域名"
              />
              <p className="text-xs text-gray-500">修改编号会影响通过子域名访问的地址，请谨慎操作</p>
            </div>
            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="输入项目描述"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false)
                  resetForm('edit')
                }}
              >
                取消
              </Button>
              <Button onClick={handleUpdateProject} disabled={updating}>
                {updating ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
