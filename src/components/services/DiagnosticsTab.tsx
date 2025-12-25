'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
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
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/date-utils'
import ReactMarkdown from 'react-markdown'
import type { DiagnosticsTabProps, ServiceDiagnostic } from '@/types/service-tabs'

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
  diagnostics,
  diagnosticsLoading,
  diagnosticsError,
  onRefresh
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
              <p className="text-sm">该服务还没有进行过诊断</p>
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