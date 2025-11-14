'use client'

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Edit3,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react'
import { toast } from 'sonner'

import {
  AIRoleTemplateApplicability,
  AIRoleTemplateListItem
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

const TYPE_LABEL: Record<AIRoleTemplateApplicability, string> = {
  ENGINEER: '研发人员',
  QA: '测试人员',
  ALL: '全部类型'
}

type TemplateFormState = {
  name: string
  applicableType: AIRoleTemplateApplicability
  systemPrompt: string
  behaviorGuidelines: string
  toolPermissions: string
  defaultModelProvider: string
  defaultModelName: string
  temperature: string
  maxTokens: string
  createdBy: string
}

const initialFormState: TemplateFormState = {
  name: '',
  applicableType: 'ENGINEER',
  systemPrompt: '',
  behaviorGuidelines: '',
  toolPermissions: '',
  defaultModelProvider: '',
  defaultModelName: '',
  temperature: '0.3',
  maxTokens: '2048',
  createdBy: ''
}

const formatDateTime = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

const parseTextarea = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

export default function RoleTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<AIRoleTemplateListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState<TemplateFormState>(initialFormState)
  const [editForm, setEditForm] = useState<TemplateFormState>(initialFormState)

  const [formSubmitting, setFormSubmitting] = useState(false)

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return templates[0] ?? null
    return templates.find((item) => item.id === selectedTemplateId) ?? null
  }, [selectedTemplateId, templates])

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/ai/role-templates')
      if (!res.ok) {
        throw new Error('加载角色模板失败')
      }
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setTemplates(list)
      setSelectedTemplateId((prev) => prev ?? (list[0]?.id ?? null))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '加载角色模板失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const openCreateDialog = () => {
    setCreateForm(initialFormState)
    setCreateDialogOpen(true)
  }

  const openEditDialog = (template: AIRoleTemplateListItem) => {
    setEditingTemplateId(template.id)
    setEditForm({
      name: template.name,
      applicableType: template.applicableType,
      systemPrompt: template.systemPrompt,
      behaviorGuidelines: template.behaviorGuidelines.join('\n'),
      toolPermissions: template.toolPermissions.join('\n'),
      defaultModelProvider: template.defaultModelProvider,
      defaultModelName: template.defaultModelName,
      temperature: String(template.defaultModelParams.temperature ?? 0.3),
      maxTokens: String(template.defaultModelParams.maxTokens ?? 2048),
      createdBy: template.createdBy
    })
    setEditDialogOpen(true)
  }

  const validateForm = (form: TemplateFormState) => {
    if (!form.name.trim()) return '请填写模板名称'
    if (!form.systemPrompt.trim()) return '请填写系统提示词'
    if (!form.defaultModelProvider.trim() || !form.defaultModelName.trim()) return '请完善默认模型配置'
    const temperature = Number.parseFloat(form.temperature)
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 1) return '温度需在 0-1 之间'
    const maxTokens = Number.parseInt(form.maxTokens, 10)
    if (Number.isNaN(maxTokens) || maxTokens <= 0) return '最大 Tokens 需为正整数'
    return null
  }

  const handleCreateTemplate = async () => {
    const errorMsg = validateForm(createForm)
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }
    setFormSubmitting(true)
    try {
      const res = await fetch('/api/ai/role-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          applicableType: createForm.applicableType,
          systemPrompt: createForm.systemPrompt.trim(),
          behaviorGuidelines: parseTextarea(createForm.behaviorGuidelines),
          toolPermissions: parseTextarea(createForm.toolPermissions),
          defaultModelProvider: createForm.defaultModelProvider.trim(),
          defaultModelName: createForm.defaultModelName.trim(),
          defaultModelParams: {
            temperature: Number.parseFloat(createForm.temperature),
            maxTokens: Number.parseInt(createForm.maxTokens, 10)
          },
          createdBy: createForm.createdBy.trim() || 'system'
        })
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result?.error || '创建模板失败')
      }
      toast.success('角色模板创建成功')
      setCreateDialogOpen(false)
      await loadTemplates()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '创建模板失败')
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId) return
    const errorMsg = validateForm(editForm)
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }
    setFormSubmitting(true)
    try {
      const res = await fetch(`/api/ai/role-templates/${editingTemplateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          applicableType: editForm.applicableType,
          systemPrompt: editForm.systemPrompt.trim(),
          behaviorGuidelines: parseTextarea(editForm.behaviorGuidelines),
          toolPermissions: parseTextarea(editForm.toolPermissions),
          defaultModelProvider: editForm.defaultModelProvider.trim(),
          defaultModelName: editForm.defaultModelName.trim(),
          defaultModelParams: {
            temperature: Number.parseFloat(editForm.temperature),
            maxTokens: Number.parseInt(editForm.maxTokens, 10)
          },
          createdBy: editForm.createdBy.trim(),
          versionIncrement: true
        })
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result?.error || '更新模板失败')
      }
      toast.success('角色模板已更新')
      setEditDialogOpen(false)
      await loadTemplates()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : '更新模板失败')
    } finally {
      setFormSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">角色模板管理</h1>
          <p className="mt-2 text-sm text-gray-500">
            管理 AI 员工的行为边界与模型配置，模板更新后可统一下发能力。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/ai/employees')} className="gap-2">
            <Users className="h-4 w-4" /> 查看 AI 员工
          </Button>
          <Button className="gap-2" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" /> 新建模板
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> 模板列表
            </CardTitle>
            <span className="text-xs text-gray-500">共 {templates.length} 个模板</span>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-gray-400">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                正在加载模板数据...
              </div>
            ) : templates.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                暂无角色模板，请先创建。
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-64">模板名称</TableHead>
                    <TableHead className="w-28">适用类型</TableHead>
                    <TableHead className="w-28">引用员工</TableHead>
                    <TableHead className="w-36">最后更新</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow
                      key={template.id}
                      className={cn(
                        'cursor-pointer hover:bg-gray-50',
                        selectedTemplate?.id === template.id ? 'bg-primary/5' : ''
                      )}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <TableCell>
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-xs text-gray-400">版本 v{template.version}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                          {TYPE_LABEL[template.applicableType]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">{template.usageCount}</TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-700">{formatDateTime(template.updatedAt)}</div>
                        <div className="text-xs text-gray-400">创建者 {template.createdBy || 'system'}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditDialog(template)
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> 模板详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-gray-600">
            {!selectedTemplate ? (
              <div className="text-center text-gray-400">请选择一个模板查看详情</div>
            ) : (
              <>
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">System Prompt</p>
                  <p className="rounded-md bg-gray-900/95 p-4 text-gray-100 shadow-inner">
                    {selectedTemplate.systemPrompt || '暂无系统提示'}
                  </p>
                </section>
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">行为约束</p>
                  {selectedTemplate.behaviorGuidelines.length === 0 ? (
                    <p className="text-xs text-gray-400">未配置行为约束</p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedTemplate.behaviorGuidelines.map((rule) => (
                        <li key={rule} className="flex items-start gap-2">
                          <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                          <span className="text-gray-700">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">推荐工具权限</p>
                  {selectedTemplate.toolPermissions.length === 0 ? (
                    <p className="text-xs text-gray-400">未配置工具权限</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.toolPermissions.map((tool) => (
                        <span key={tool} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 创建模板弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>新建角色模板</DialogTitle>
            <DialogDescription>定义系统提示、行为约束与默认模型配置。</DialogDescription>
          </DialogHeader>
          <TemplateForm
            form={createForm}
            onChange={setCreateForm}
            submitting={formSubmitting}
            onSubmit={handleCreateTemplate}
            onCancel={() => setCreateDialogOpen(false)}
            submitText="创建模板"
          />
        </DialogContent>
      </Dialog>

      {/* 编辑模板弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>编辑角色模板</DialogTitle>
            <DialogDescription>版本将自动 +1，以便追踪模板历史。</DialogDescription>
          </DialogHeader>
          <TemplateForm
            form={editForm}
            onChange={setEditForm}
            submitting={formSubmitting}
            onSubmit={handleUpdateTemplate}
            onCancel={() => setEditDialogOpen(false)}
            submitText="保存修改"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

type TemplateFormProps = {
  form: TemplateFormState
  submitting: boolean
  onChange: Dispatch<SetStateAction<TemplateFormState>>
  onSubmit: () => void
  onCancel: () => void
  submitText: string
}

function TemplateForm({ form, submitting, onChange, onSubmit, onCancel, submitText }: TemplateFormProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>模板名称 *</Label>
          <Input
            value={form.name}
            onChange={(event) => onChange((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="例如：前端研发模板"
          />
        </div>
        <div className="space-y-2">
          <Label>适用员工类型 *</Label>
          <Select
            value={form.applicableType}
            onValueChange={(value) => onChange((prev) => ({ ...prev, applicableType: value as AIRoleTemplateApplicability }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ENGINEER">研发人员</SelectItem>
              <SelectItem value="QA">测试人员</SelectItem>
              <SelectItem value="ALL">全部类型</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>默认模型提供方 *</Label>
          <Input
            value={form.defaultModelProvider}
            onChange={(event) => onChange((prev) => ({ ...prev, defaultModelProvider: event.target.value }))}
            placeholder="例如：openai"
          />
        </div>
        <div className="space-y-2">
          <Label>默认模型名称 *</Label>
          <Input
            value={form.defaultModelName}
            onChange={(event) => onChange((prev) => ({ ...prev, defaultModelName: event.target.value }))}
            placeholder="例如：gpt-4o"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>模型温度</Label>
          <Input
            value={form.temperature}
            onChange={(event) => onChange((prev) => ({ ...prev, temperature: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>最大 Tokens</Label>
          <Input
            value={form.maxTokens}
            onChange={(event) => onChange((prev) => ({ ...prev, maxTokens: event.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>系统提示词 *</Label>
        <Textarea
          rows={4}
          value={form.systemPrompt}
          onChange={(event) => onChange((prev) => ({ ...prev, systemPrompt: event.target.value }))}
          placeholder="描述 AI 员工的角色定位与目标"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>行为约束</Label>
          <Textarea
            rows={5}
            value={form.behaviorGuidelines}
            onChange={(event) => onChange((prev) => ({ ...prev, behaviorGuidelines: event.target.value }))}
            placeholder={['每行一条行为约束，例如：', '• 所有变更需更新文档', '• 发布前通过回归测试'].join('\n')}
          />
        </div>
        <div className="space-y-2">
          <Label>推荐工具权限</Label>
          <Textarea
            rows={5}
            value={form.toolPermissions}
            onChange={(event) => onChange((prev) => ({ ...prev, toolPermissions: event.target.value }))}
            placeholder={['每行一个工具，例如：', 'Git 仓库访问', 'CI 构建权限'].join('\n')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>创建者</Label>
        <Input
          value={form.createdBy}
          onChange={(event) => onChange((prev) => ({ ...prev, createdBy: event.target.value }))}
          placeholder="例如：platform.admin"
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button onClick={onSubmit} disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitText}
        </Button>
      </div>
    </div>
  )
}
