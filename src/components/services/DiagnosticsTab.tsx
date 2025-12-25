'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  RefreshCw, 
  FileText, 
  Calendar, 
  User, 
  Tag,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Bot,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/date-utils'
import ReactMarkdown from 'react-markdown'
import { serviceSvc } from '@/service/serviceSvc'
import { xuanwuAiSvc, type CreateAiDiagnosticTaskRequest } from '@/service/xuanwuAiSvc'
import type { DiagnosticsTabProps, ServiceDiagnostic } from '@/types/service-tabs'
import type { Service, ApplicationService } from '@/types/project'

/**
 * 玄武AI诊断按钮组件
 */
function XuanwuAiDiagnosticButton({ 
  service,
  serviceId,
  onDiagnosticComplete
}: { 
  service?: Service | null
  serviceId: string
  onDiagnosticComplete?: () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleAiDiagnostic = async () => {
    if (!service) {
      toast.error('服务信息不可用')
      return
    }

    setLoading(true)
    try {
      // 获取K8s状态信息
      const k8sStatus = await serviceSvc.getK8sServiceStatus(serviceId)
      
      if (!k8sStatus.namespace) {
        toast.error('无法获取服务的Kubernetes命名空间信息')
        return
      }

      // 获取第一个可用的Pod名称
      let podName = ''
      if (k8sStatus.podStatus?.pods && k8sStatus.podStatus.pods.length > 0) {
        podName = k8sStatus.podStatus.pods[0].name
      } else if (k8sStatus.serviceName) {
        // 如果没有具体的Pod信息，使用服务名作为Pod名称前缀
        podName = k8sStatus.serviceName
      } else {
        // 最后使用服务名称
        podName = service.name
      }

      // 构建AI诊断任务参数（只传递K8s相关信息，Git信息由后端处理）
      const taskParams: CreateAiDiagnosticTaskRequest = {
        namespace: k8sStatus.namespace,
        pod: podName
      }

      // 通过后端API创建AI诊断任务
      const result = await xuanwuAiSvc.createDiagnosticTask(serviceId, taskParams)
      
      toast.success(`AI诊断任务已创建，任务ID: ${result.task_id}`)
      
      // 可选：调用完成回调
      if (onDiagnosticComplete) {
        onDiagnosticComplete()
      }
      
    } catch (error) {
      console.error('AI诊断失败:', error)
      toast.error('AI诊断失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleAiDiagnostic}
      disabled={loading || !service}
      variant="outline"
      size="sm"
      className="gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100"
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <Bot className="w-4 h-4" />
      )}
      <Zap className="w-3 h-3" />
      玄武AI诊断
    </Button>
  )
}

/**
 * 创建诊断记录表单组件
 */
function CreateDiagnosticDialog({ 
  onCreateDiagnostic,
  trigger 
}: { 
  onCreateDiagnostic: (diagnostic: {
    conclusion: string
    diagnostician: string
    reportCategory: string
    reportDetail: string
    diagnosticTime?: string
  }) => Promise<void>
  trigger: React.ReactNode 
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    conclusion: '',
    diagnostician: '',
    reportCategory: '',
    reportDetail: '',
    diagnosticTime: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证必填字段
    if (!formData.conclusion.trim()) {
      toast.error('请输入诊断结论')
      return
    }
    if (!formData.diagnostician.trim()) {
      toast.error('请输入诊断人')
      return
    }
    if (!formData.reportCategory.trim()) {
      toast.error('请选择归因分类')
      return
    }
    if (!formData.reportDetail.trim()) {
      toast.error('请输入报告详情')
      return
    }

    setLoading(true)
    try {
      await onCreateDiagnostic({
        conclusion: formData.conclusion.trim(),
        diagnostician: formData.diagnostician.trim(),
        reportCategory: formData.reportCategory,
        reportDetail: formData.reportDetail.trim(),
        diagnosticTime: formData.diagnosticTime
      })
      
      // 重置表单
      setFormData({
        conclusion: '',
        diagnostician: '',
        reportCategory: '',
        reportDetail: '',
        diagnosticTime: new Date().toISOString().slice(0, 16)
      })
      
      setOpen(false)
      toast.success('诊断记录创建成功')
    } catch (error) {
      toast.error('创建失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
    // 重置表单
    setFormData({
      conclusion: '',
      diagnostician: '',
      reportCategory: '',
      reportDetail: '',
      diagnosticTime: new Date().toISOString().slice(0, 16)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            添加诊断记录
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* 诊断时间 */}
              <div className="space-y-2">
                <Label htmlFor="diagnosticTime">诊断时间</Label>
                <Input
                  id="diagnosticTime"
                  type="datetime-local"
                  value={formData.diagnosticTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, diagnosticTime: e.target.value }))}
                  required
                />
              </div>

              {/* 诊断人 */}
              <div className="space-y-2">
                <Label htmlFor="diagnostician">诊断人 *</Label>
                <Input
                  id="diagnostician"
                  placeholder="请输入诊断人姓名"
                  value={formData.diagnostician}
                  onChange={(e) => setFormData(prev => ({ ...prev, diagnostician: e.target.value }))}
                  required
                />
              </div>

              {/* 诊断结论 */}
              <div className="space-y-2">
                <Label htmlFor="conclusion">诊断结论 *</Label>
                <Input
                  id="conclusion"
                  placeholder="请输入诊断结论"
                  value={formData.conclusion}
                  onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
                  required
                />
              </div>

              {/* 归因分类 */}
              <div className="space-y-2">
                <Label htmlFor="reportCategory">归因分类 *</Label>
                <Select
                  value={formData.reportCategory}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, reportCategory: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="请选择归因分类" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="应用问题">应用问题</SelectItem>
                    <SelectItem value="基础设施">基础设施</SelectItem>
                    <SelectItem value="网络问题">网络问题</SelectItem>
                    <SelectItem value="存储问题">存储问题</SelectItem>
                    <SelectItem value="配置问题">配置问题</SelectItem>
                    <SelectItem value="性能问题">性能问题</SelectItem>
                    <SelectItem value="安全问题">安全问题</SelectItem>
                    <SelectItem value="其他">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 报告详情 */}
              <div className="space-y-2">
                <Label htmlFor="reportDetail">报告详情 *</Label>
                <Textarea
                  id="reportDetail"
                  placeholder="请输入详细的诊断报告，支持 Markdown 格式"
                  value={formData.reportDetail}
                  onChange={(e) => setFormData(prev => ({ ...prev, reportDetail: e.target.value }))}
                  rows={8}
                  required
                />
                <p className="text-xs text-gray-500">
                  支持 Markdown 格式，可以使用 **粗体**、*斜体*、`代码`、列表等格式
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              创建记录
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 诊断结论的状态映射
 */
const getConclusionBadge = (conclusion: string) => {
  const lower = conclusion.toLowerCase()
  
  if (lower.includes('正常') || lower.includes('健康') || lower.includes('良好')) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        {conclusion}
      </Badge>
    )
  }
  
  if (lower.includes('警告') || lower.includes('注意') || lower.includes('建议')) {
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        {conclusion}
      </Badge>
    )
  }
  
  if (lower.includes('异常') || lower.includes('错误') || lower.includes('故障') || lower.includes('失败')) {
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
        <XCircle className="w-3 h-3 mr-1" />
        {conclusion}
      </Badge>
    )
  }
  
  return (
    <Badge variant="outline">
      <Clock className="w-3 h-3 mr-1" />
      {conclusion}
    </Badge>
  )
}

/**
 * 诊断报告详情弹窗组件
 */
function DiagnosticReportDialog({ 
  diagnostic, 
  trigger 
}: { 
  diagnostic: ServiceDiagnostic
  trigger: React.ReactNode 
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            诊断报告详情
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 诊断基本信息 */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">诊断时间:</span>
              <span className="text-sm font-medium">
                {formatDateTime(diagnostic.diagnosticTime)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">诊断人:</span>
              <span className="text-sm font-medium">{diagnostic.diagnostician}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">归因分类:</span>
              <span className="text-sm font-medium">{diagnostic.reportCategory}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">诊断结论:</span>
              {getConclusionBadge(diagnostic.conclusion)}
            </div>
          </div>
          
          {/* 报告详情 */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">报告详情</h4>
            <ScrollArea className="h-96 w-full border rounded-lg p-4">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>
                  {diagnostic.reportDetail}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 服务诊断Tab组件
 */
export function DiagnosticsTab({
  serviceId,
  service,
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  onRefresh,
  onCreateDiagnostic
}: DiagnosticsTabProps) {
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh()
      toast.success('诊断记录已刷新')
    } catch (error) {
      toast.error('刷新失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 头部操作区 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">服务诊断记录</h3>
          <p className="text-sm text-gray-600">
            查看服务的历史诊断记录和详细报告
          </p>
        </div>
        <div className="flex items-center gap-2">
          <XuanwuAiDiagnosticButton
            service={service}
            serviceId={serviceId}
            onDiagnosticComplete={() => onRefresh()}
          />
          <CreateDiagnosticDialog
            onCreateDiagnostic={onCreateDiagnostic}
            trigger={
              <Button
                variant="default"
                size="sm"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                添加诊断记录
              </Button>
            }
          />
          <Button
            onClick={handleRefresh}
            disabled={refreshing || diagnosticsLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 诊断记录表格 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">诊断记录</CardTitle>
        </CardHeader>
        <CardContent>
          {diagnosticsError ? (
            <div className="flex items-center justify-center py-8 text-red-600">
              <AlertCircle className="w-5 h-5 mr-2" />
              加载失败: {diagnosticsError}
            </div>
          ) : diagnosticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : diagnostics.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">暂无诊断记录</p>
              <p className="text-sm mb-6">该服务还没有进行过诊断</p>
              <div className="flex items-center gap-3">
                <XuanwuAiDiagnosticButton
                  service={service}
                  serviceId={serviceId}
                  onDiagnosticComplete={() => onRefresh()}
                />
                <CreateDiagnosticDialog
                  onCreateDiagnostic={onCreateDiagnostic}
                  trigger={
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      添加第一条诊断记录
                    </Button>
                  }
                />
              </div>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>诊断时间</TableHead>
                    <TableHead>诊断结论</TableHead>
                    <TableHead>诊断人</TableHead>
                    <TableHead>归因分类</TableHead>
                    <TableHead className="text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnostics.map((diagnostic) => (
                    <TableRow key={diagnostic.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {formatDateTime(diagnostic.diagnosticTime)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getConclusionBadge(diagnostic.conclusion)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{diagnostic.diagnostician}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {diagnostic.reportCategory}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <DiagnosticReportDialog
                          diagnostic={diagnostic}
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              查看报告
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}