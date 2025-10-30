'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Package, Database, Box, Filter, Search, MoreVertical, Play, Square, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { projectSvc } from '@/service/projectSvc'
import { serviceSvc } from '@/service/serviceSvc'
import { ServiceType } from '@/types/project'
import type { Project, Service } from '@/types/project'
import ServiceCreateForm from '../components/ServiceCreateForm'

const SERVICE_TYPE_ICONS: Record<string, any> = {
  application: Package,
  database: Database,
  compose: Box
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  application: 'Application',
  database: 'Database',
  compose: 'Compose'
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500',
  pending: 'bg-yellow-500',
  stopped: 'bg-gray-500',
  error: 'bg-red-500'
}

const STATUS_LABELS: Record<string, string> = {
  running: '运行中',
  pending: '待启动',
  stopped: '已停止',
  error: '错误'
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedType, setSelectedType] = useState<ServiceType | 'all'>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createServiceType, setCreateServiceType] = useState<ServiceType | null>(null)

  // 加载项目信息
  const loadProject = async () => {
    if (!id) return
    
    try {
      const data = await projectSvc.getProjectById(id)
      setProject(data)
    } catch (error: any) {
      toast.error('加载项目失败：' + error.message)
    }
  }

  // 加载服务列表
  const loadServices = async () => {
    if (!id) return
    
    try {
      setLoading(true)
      const data = await serviceSvc.getServicesByProject(id)
      setServices(data)
    } catch (error: any) {
      toast.error('加载服务失败：' + error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
    loadServices()
  }, [id])

  // 打开创建服务对话框
  const handleOpenCreateDialog = (type: ServiceType) => {
    setCreateServiceType(type)
    setIsCreateDialogOpen(true)
  }

  // 删除服务
  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('确定要删除这个服务吗？')) return
    
    try {
      await serviceSvc.deleteService(serviceId)
      toast.success('服务删除成功')
      loadServices()
    } catch (error: any) {
      toast.error('删除服务失败：' + error.message)
    }
  }

  // 过滤服务
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchKeyword.toLowerCase())
    const matchesType = selectedType === 'all' || service.type === selectedType
    return matchesSearch && matchesType
  })

  // 统计服务数量
  const serviceStats = {
    total: services.length,
    application: services.filter(s => s.type === 'application').length,
    database: services.filter(s => s.type === 'database').length,
    compose: services.filter(s => s.type === 'compose').length
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/projects')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            返回项目列表
          </Button>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
                {project?.description && (
                  <p className="text-gray-500 mt-2">{project.description}</p>
                )}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    创建服务
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenCreateDialog(ServiceType.APPLICATION)}>
                    <Package className="w-4 h-4 mr-2" />
                    Application
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenCreateDialog(ServiceType.DATABASE)}>
                    <Database className="w-4 h-4 mr-2" />
                    Database
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenCreateDialog(ServiceType.COMPOSE)}>
                    <Box className="w-4 h-4 mr-2" />
                    Compose
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 服务统计 */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{serviceStats.total}</div>
                <div className="text-sm text-gray-500">总服务数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{serviceStats.application}</div>
                <div className="text-sm text-gray-500">Applications</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{serviceStats.database}</div>
                <div className="text-sm text-gray-500">Databases</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{serviceStats.compose}</div>
                <div className="text-sm text-gray-500">Composes</div>
              </div>
            </div>
          </div>
        </div>

        {/* 筛选和搜索 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="搜索服务..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {selectedType === 'all' ? '全部类型' : SERVICE_TYPE_LABELS[selectedType]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedType('all')}>
                全部类型
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType(ServiceType.APPLICATION)}>
                <Package className="w-4 h-4 mr-2" />
                Application
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType(ServiceType.DATABASE)}>
                <Database className="w-4 h-4 mr-2" />
                Database
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedType(ServiceType.COMPOSE)}>
                <Box className="w-4 h-4 mr-2" />
                Compose
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 服务列表 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无服务</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const Icon = SERVICE_TYPE_ICONS[service.type]
              const statusColor = STATUS_COLORS[service.status || 'pending']
              const statusLabel = STATUS_LABELS[service.status || 'pending']
              
              return (
                <Card 
                  key={service.id} 
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={() => router.push(`/projects/${id}/services/${service.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="w-5 h-5 text-gray-700" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{service.name}</h3>
                          <Badge variant="outline" className="mt-1">
                            {SERVICE_TYPE_LABELS[service.type]}
                          </Badge>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            // TODO: 启动服务
                          }}>
                            <Play className="w-4 h-4 mr-2" />
                            启动
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            // TODO: 停止服务
                          }}>
                            <Square className="w-4 h-4 mr-2" />
                            停止
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              service.id && handleDeleteService(service.id)
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">状态</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                          <span className="text-gray-900">{statusLabel}</span>
                        </div>
                      </div>
                      
                      {service.type === ServiceType.APPLICATION && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">代码源</span>
                            <span className="text-gray-900 truncate ml-2">{service.git_repository || '-'}</span>
                          </div>
                          {service.port && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">端口</span>
                              <span className="text-gray-900">{service.port}</span>
                            </div>
                          )}
                        </>
                      )}
                      
                      {service.type === ServiceType.DATABASE && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">类型</span>
                            <span className="text-gray-900 uppercase">{service.database_type}</span>
                          </div>
                          {service.version && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">版本</span>
                              <span className="text-gray-900">{service.version}</span>
                            </div>
                          )}
                        </>
                      )}
                      
                      {service.type === ServiceType.COMPOSE && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">镜像</span>
                          <span className="text-gray-900 truncate ml-2">
                            {service.image}{service.tag && `:${service.tag}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 创建服务对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建 {createServiceType && SERVICE_TYPE_LABELS[createServiceType]}</DialogTitle>
            <DialogDescription>
              配置新服务的参数
            </DialogDescription>
          </DialogHeader>
          
          {createServiceType && id && (
            <ServiceCreateForm
              projectId={id}
              serviceType={createServiceType}
              onSuccess={() => {
                setIsCreateDialogOpen(false)
                setCreateServiceType(null)
                loadServices()
              }}
              onCancel={() => {
                setIsCreateDialogOpen(false)
                setCreateServiceType(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
