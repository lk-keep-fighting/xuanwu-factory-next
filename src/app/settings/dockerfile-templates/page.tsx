'use client'

import { useState } from 'react'
import { Plus, Edit, Trash2, Eye, Copy, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDockerfileTemplates } from '@/hooks/useDockerfileTemplates'
import { DockerfileTemplateDialog } from '@/components/admin/DockerfileTemplateDialog'
import { DockerfileTemplateViewDialog } from '@/components/admin/DockerfileTemplateViewDialog'
import type { DockerfileTemplate } from '@/types/project'

/**
 * Dockerfile模版管理页面 - 系统配置版本
 */
export default function DockerfileTemplatesSettingsPage() {
  const { templates, categories, loading, error, refetch } = useDockerfileTemplates()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [editingTemplate, setEditingTemplate] = useState<DockerfileTemplate | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<DockerfileTemplate | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // 过滤模版
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // 处理删除模版
  const handleDeleteTemplate = async (template: DockerfileTemplate) => {
    if (!confirm(`确定要删除模版 "${template.name}" 吗？`)) {
      return
    }

    try {
      const response = await fetch(`/api/dockerfile-templates/${template.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await refetch()
      } else {
        const data = await response.json()
        alert(`删除失败: ${data.error}`)
      }
    } catch (error) {
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 处理复制模版
  const handleCopyTemplate = (template: DockerfileTemplate) => {
    const newTemplate = {
      ...template,
      id: `${template.id}-copy`,
      name: `${template.name} (副本)`
    }
    setEditingTemplate(newTemplate)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">加载模版中...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-500">加载失败: {error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dockerfile模板配置</h1>
          <p className="text-gray-600 mt-1">管理和维护系统Dockerfile构建模板</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          新建模板
        </Button>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
            <div className="text-sm text-gray-600">总模板数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{categories.length}</div>
            <div className="text-sm text-gray-600">分类数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {templates.filter(t => t.category === '前端').length}
            </div>
            <div className="text-sm text-gray-600">前端模板</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {templates.filter(t => t.category === 'Java').length}
            </div>
            <div className="text-sm text-gray-600">Java模板</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索模板名称或描述..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="选择分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有分类</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label} ({category.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 模板列表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTemplates.map(template => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{template.category}</Badge>
                    {template.id.includes('system') && (
                      <Badge variant="outline">系统模板</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {template.description}
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">基础镜像:</span> {template.baseImage}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-medium">端口:</span> {template.exposePorts.join(', ') || '无'}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingTemplate(template)}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  查看
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTemplate(template)}
                  className="flex items-center gap-1"
                >
                  <Edit className="h-3 w-3" />
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyTemplate(template)}
                  className="flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  复制
                </Button>
                {!template.id.includes('system') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTemplate(template)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    删除
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">没有找到匹配的模板</div>
          <p className="text-gray-400 mt-2">尝试调整搜索条件或创建新模板</p>
        </div>
      )}

      {/* 对话框 */}
      <DockerfileTemplateDialog
        template={editingTemplate}
        open={!!editingTemplate || isCreateDialogOpen}
        onClose={() => {
          setEditingTemplate(null)
          setIsCreateDialogOpen(false)
        }}
        onSave={async () => {
          await refetch()
          setEditingTemplate(null)
          setIsCreateDialogOpen(false)
        }}
      />

      <DockerfileTemplateViewDialog
        template={viewingTemplate}
        open={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
      />
    </div>
  )
}