import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  Input,
  Textarea,
  FormMessage,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Label
} from '@/components/ui';
import ResourceQuotaComponent from './ResourceQuota';
import type { 
  ContainerAppConfig, 
  CreateContainerAppRequest,
  ResourceQuota,
  ImageConfig,
  DeploymentInfo,
  NetworkConfig,
  EnvironmentVariable
} from '@/types/container';
import { containerSvc } from '@/service/containerSvc';
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';

// 表单验证模式
const containerFormSchema = z.object({
  // Basic信息
  name: z.string().min(1, '应用名称不能为空').max(63, '应用名称不能超过63个字符'),
  description: z.string().optional(),
  
  // 镜像配置
  image: z.object({
    visibility: z.enum(['public', 'private']),
    imageName: z.string().min(1, '镜像名称不能为空'),
    tag: z.string().optional(),
    registry: z.string().optional(),
    credentials: z.object({
      username: z.string(),
      password: z.string()
    }).optional()
  }),
  
  // 部署配置
  deployment: z.object({
    type: z.enum(['fixed', 'scaling']),
    replicas: z.number().min(1).max(100),
    minReplicas: z.number().optional(),
    maxReplicas: z.number().optional(),
    targetCpuUtilization: z.number().optional()
  }),
  
  // 网络配置
  network: z.object({
    containerPort: z.number().min(1).max(65535),
    enableInternetAccess: z.boolean(),
    domain: z.string().optional(),
    customDomain: z.string().optional(),
    protocol: z.enum(['http', 'https', 'tcp', 'udp'])
  }),
  
  // 环境变量
  environmentVariables: z.array(z.object({
    key: z.string().min(1),
    value: z.string(),
    type: z.enum(['plain', 'secret', 'configmap'])
  })).optional()
});

type ContainerFormData = z.infer<typeof containerFormSchema>;

interface ContainerFormProps {
  appId?: number;
  isEdit?: boolean;
  editingConfig?: ContainerAppConfig;
  onClose: () => void;
  onSuccess: () => void;
}

const ContainerForm: React.FC<ContainerFormProps> = ({
  appId,
  isEdit = false,
  editingConfig,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [resources, setResources] = useState<ResourceQuota>({
    cpu: 0.2,
    memory: 256,
    storage: 0
  });
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariable[]>([
    { key: '', value: '', type: 'plain' }
  ]);
  const [showPasswords, setShowPasswords] = useState<{[key: number]: boolean}>({});

  const form = useForm<ContainerFormData>({
    resolver: zodResolver(containerFormSchema),
    defaultValues: {
      name: editingConfig?.name || 'hello-world',
      description: editingConfig?.description || '',
      image: {
        visibility: editingConfig?.image.visibility || 'public',
        imageName: editingConfig?.image.imageName || 'nginx',
        tag: editingConfig?.image.tag || 'latest'
      },
      deployment: {
        type: editingConfig?.deployment.type || 'fixed',
        replicas: editingConfig?.deployment.replicas || 1
      },
      network: {
        containerPort: editingConfig?.network.containerPort || 80,
        enableInternetAccess: editingConfig?.network.enableInternetAccess ?? true,
        protocol: editingConfig?.network.protocol || 'http'
      },
      environmentVariables: editingConfig?.advanced?.environmentVariables || []
    }
  });

  // 监听表单数据变化
  React.useEffect(() => {
    if (editingConfig) {
      setResources(editingConfig.resources);
      setEnvironmentVariables(editingConfig.advanced?.environmentVariables || []);
    }
  }, [editingConfig]);

  const handleSubmit = async (data: ContainerFormData) => {
    try {
      const config: ContainerAppConfig = {
        name: data.name,
        description: data.description,
        image: data.image,
        resources,
        deployment: data.deployment,
        network: data.network,
        advanced: {
          environmentVariables: environmentVariables.filter(env => env.key && env.value)
        }
      };

      const request: CreateContainerAppRequest = {
        appId,
        config
      };

      if (isEdit && editingConfig) {
        await containerSvc.updateContainerApp({
          id: (editingConfig as any).id,
          config
        });
      } else {
        await containerSvc.createContainerApp(request);
      }

      onSuccess();
    } catch (error) {
      console.error('容器应用保存失败:', error);
    }
  };

  const addEnvironmentVariable = () => {
    setEnvironmentVariables([...environmentVariables, { key: '', value: '', type: 'plain' }]);
  };

  const removeEnvironmentVariable = (index: number) => {
    setEnvironmentVariables(environmentVariables.filter((_, i) => i !== index));
  };

  const updateEnvironmentVariable = (index: number, field: keyof EnvironmentVariable, value: string) => {
    const updated = [...environmentVariables];
    updated[index] = { ...updated[index], [field]: value };
    setEnvironmentVariables(updated);
  };

  const togglePasswordVisibility = (index: number) => {
    setShowPasswords(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? '编辑容器应用' : '创建容器应用'}
        </DialogTitle>
        <DialogDescription>
          配置基于Kubernetes的容器化应用部署
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="overflow-y-auto max-h-[70vh]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="network">Network</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Configuration</TabsTrigger>
              </TabsList>

              {/* Basic标签页 */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="hello-world" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <Label>Image</Label>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="image.visibility"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant={field.value === 'public' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => field.onChange('public')}
                                  >
                                    Public
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={field.value === 'private' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => field.onChange('private')}
                                  >
                                    Private
                                  </Button>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="image.imageName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Image Name</FormLabel>
                            <FormControl>
                              <Input placeholder="nginx" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <Label>Deployment Information</Label>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="deployment.type"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant={field.value === 'fixed' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => field.onChange('fixed')}
                                  >
                                    Fixed
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={field.value === 'scaling' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => field.onChange('scaling')}
                                  >
                                    Scaling
                                  </Button>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="deployment.replicas"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              Replicas
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => field.onChange(Math.max(1, field.value - 1))}
                                >
                                  -
                                </Button>
                                <span className="text-lg font-mono w-8 text-center">{field.value}</span>
                                <Button
                                  type="button"
                                  variant="outline" 
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => field.onChange(Math.min(100, field.value + 1))}
                                >
                                  +
                                </Button>
                              </div>
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="block mb-4">Resource Quota</Label>
                    <ResourceQuotaComponent
                      value={resources}
                      onChange={setResources}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Network标签页 */}
              <TabsContent value="network" className="space-y-6 mt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="network.containerPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Container Port</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="80" 
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 80)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="network.enableInternetAccess"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            Enable Internet Access
                            <Button
                              type="button"
                              variant={field.value ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => field.onChange(!field.value)}
                            >
                              {field.value ? 'ON' : 'OFF'}
                            </Button>
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {form.watch('network.enableInternetAccess') && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="network.domain"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">https://</span>
                                  <Input 
                                    placeholder="bgpiszjejmga.usw.sailos.io"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <Button type="button" variant="link" size="sm" className="p-0">
                          Custom Domain
                        </Button>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="network.protocol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Protocol</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              {['http', 'https', 'tcp', 'udp'].map(protocol => (
                                <Button
                                  key={protocol}
                                  type="button"
                                  variant={field.value === protocol ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => field.onChange(protocol)}
                                >
                                  {protocol.toUpperCase()}
                                </Button>
                              ))}
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Port
                </Button>
              </TabsContent>

              {/* Advanced Configuration标签页 */}
              <TabsContent value="advanced" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Environment Variables</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {environmentVariables.map((envVar, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Key"
                          value={envVar.key}
                          onChange={e => updateEnvironmentVariable(index, 'key', e.target.value)}
                        />
                        <div className="relative flex-1">
                          <Input
                            type={envVar.type === 'secret' && !showPasswords[index] ? 'password' : 'text'}
                            placeholder="Value"
                            value={envVar.value}
                            onChange={e => updateEnvironmentVariable(index, 'value', e.target.value)}
                          />
                          {envVar.type === 'secret' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-2"
                              onClick={() => togglePasswordVisibility(index)}
                            >
                              {showPasswords[index] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                        <select
                          value={envVar.type}
                          onChange={e => updateEnvironmentVariable(index, 'type', e.target.value as any)}
                          className="px-3 py-2 border rounded-md"
                        >
                          <option value="plain">Plain</option>
                          <option value="secret">Secret</option>
                          <option value="configmap">ConfigMap</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeEnvironmentVariable(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEnvironmentVariable}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Environment Variable
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">
              {isEdit ? '更新' : '创建'}容器应用
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default ContainerForm;
