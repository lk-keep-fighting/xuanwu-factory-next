'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, Calendar, MoreVertical, Pencil, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

  if (diffInHours < 1) return '刚刚创建'
  if (diffInHours < 24) return `创建于 ${diffInHours} 小时前`
  if (diffInHours < 48) return '创建于 1 天前'
  return `创建于 ${Math.floor(diffInHours / 24)} 天前`
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

  const loadProjects = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data)
    } catch (error: unknown) {
      toast.error(`加载项目失败：${getErrorMessage(error)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">项目管理</h1>
          <div className="flex items-center gap-2">
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

        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">暂无项目</p>
              <Button onClick={() => {
                resetForm('create')
                setIsCreateDialogOpen(true)
              }}>创建第一个项目</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-1"
                onClick={() => project.id && router.push(`/projects/${project.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle>{project.name}</CardTitle>
                  </div>
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
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Tag className="w-4 h-4" />
                    <span>{project.identifier}</span>
                  </div>
                  <p className="text-gray-600 text-sm min-h-[48px]">
                    {project.description || '暂无描述'}
                  </p>
                </CardContent>
                <CardFooter className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(project.created_at)}
                </CardFooter>
              </Card>
            ))}
          </div>
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
