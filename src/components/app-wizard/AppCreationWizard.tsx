import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Card,
  CardContent,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  Input,
  Textarea,
  FormMessage,
  Badge
} from '@/components/ui';
import { Code, Container, ArrowRight, ArrowLeft, Check, Plus, Trash2, Terminal, Settings, ToggleLeft, ToggleRight, FileText, Copy } from 'lucide-react';
import type { AppDeploymentType, ContainerAppConfig, ResourceQuota, EnvironmentVariable, StartupCommand } from '@/types/container';
import ResourceQuotaComponent from '@/components/container/ResourceQuota';

interface AppCreationWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}



// 步骤枚举
type WizardStep = 'type' | 'basic' | 'container' | 'review';

// 表单验证
const basicFormSchema = z.object({
  name: z.string().min(1, '应用名称不能为空'),
  description: z.string().optional(),
  gitUrl: z.string().optional(),
});

const AppCreationWizard: React.FC<AppCreationWizardProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('type');
  const [deploymentType, setDeploymentType] = useState<AppDeploymentType>('source');
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [resources, setResources] = useState<ResourceQuota>({
    cpu: 0.2,
    memory: 256,
    storage: 0
  });
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariable[]>([]);
  const [startupCommand, setStartupCommand] = useState<StartupCommand>({
    command: [],
    args: [],
    workingDir: ''
  });


  const basicForm = useForm({
    resolver: zodResolver(basicFormSchema),
    defaultValues: {
      name: '',
      description: '',
      gitUrl: ''
    }
  });

  const containerForm = useForm({
    defaultValues: {
      imageName: 'nginx',
      imageVisibility: 'public',
      containerPort: 80,
      replicas: 1
    }
  });



  // 步骤配置
  const steps: Record<WizardStep, { title: string; description: string }> = {
    type: { title: '选择部署方式', description: '选择最适合您应用的部署方式' },
    basic: { title: '基本信息', description: '填写应用的基本配置信息' },
    container: { title: '容器配置', description: '配置容器化部署参数' },
    review: { title: '确认创建', description: '检查配置并获取 Kubernetes YAML 文件' }
  };

  const getStepIndex = (step: WizardStep): number => {
    return Object.keys(steps).indexOf(step);
  };

  const isStepCompleted = (step: WizardStep): boolean => {
    return getStepIndex(step) < getStepIndex(currentStep);
  };

  // Environment variables management
  const addEnvironmentVariable = () => {
    setEnvironmentVariables(prev => [...prev, { key: '', value: '', type: 'plain' }]);
  };

  const removeEnvironmentVariable = (index: number) => {
    setEnvironmentVariables(prev => prev.filter((_, i) => i !== index));
  };

  const updateEnvironmentVariable = (index: number, field: keyof EnvironmentVariable, value: string) => {
    setEnvironmentVariables(prev => 
      prev.map((env, i) => i === index ? { ...env, [field]: value } : env)
    );
  };

  // Startup command management
  const updateStartupCommand = (field: keyof StartupCommand, value: string | string[]) => {
    setStartupCommand(prev => ({ ...prev, [field]: value }));
  };

  const addCommandArg = (type: 'command' | 'args') => {
    setStartupCommand(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), '']
    }));
  };

  const removeCommandArg = (type: 'command' | 'args', index: number) => {
    setStartupCommand(prev => ({
      ...prev,
      [type]: (prev[type] || []).filter((_, i) => i !== index)
    }));
  };

  const updateCommandArg = (type: 'command' | 'args', index: number, value: string) => {
    setStartupCommand(prev => ({
      ...prev,
      [type]: (prev[type] || []).map((arg, i) => i === index ? value : arg)
    }));
  };

  // 生成 Kubernetes YAML
  const generateKubernetesYaml = () => {
    const basicData = basicForm.getValues();
    const containerData = containerForm.getValues();
    const appName = basicData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Deployment YAML
    const deploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  labels:
    app: ${appName}
spec:
  replicas: ${isAdvancedMode ? containerData.replicas : 1}
  selector:
    matchLabels:
      app: ${appName}
  template:
    metadata:
      labels:
        app: ${appName}
    spec:
      containers:
      - name: ${appName}
        image: ${containerData.imageName}
        ports:
        - containerPort: ${containerData.containerPort}${isAdvancedMode && startupCommand.workingDir ? `
        workingDir: ${startupCommand.workingDir}` : ''}${isAdvancedMode && startupCommand.command && startupCommand.command.length > 0 ? `
        command: [${startupCommand.command.map(cmd => `"${cmd}"`).join(', ')}]` : ''}${isAdvancedMode && startupCommand.args && startupCommand.args.length > 0 ? `
        args: [${startupCommand.args.map(arg => `"${arg}"`).join(', ')}]` : ''}${isAdvancedMode && environmentVariables.length > 0 ? `
        env:${environmentVariables.map(env => `
        - name: ${env.key}
          value: "${env.value}"`).join('')}` : ''}${isAdvancedMode ? `
        resources:
          requests:
            cpu: "${resources.cpu}"
            memory: "${resources.memory}Mi"
          limits:
            cpu: "${resources.cpu * 2}"
            memory: "${resources.memory * 2}Mi"` : ''}`;

    // Service YAML
    const serviceYaml = `apiVersion: v1
kind: Service
metadata:
  name: ${appName}-service
  labels:
    app: ${appName}
spec:
  selector:
    app: ${appName}
  ports:
  - protocol: TCP
    port: 80
    targetPort: ${containerData.containerPort}
  type: ClusterIP`;

    return { deploymentYaml, serviceYaml };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'type':
        return !!deploymentType;
      case 'basic':
        return basicForm.formState.isValid;
      case 'container':
        return deploymentType === 'source' || containerForm.formState.isValid;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const stepOrder: WizardStep[] = 
      deploymentType === 'container' 
        ? ['type', 'basic', 'container', 'review']
        : ['type', 'basic', 'review'];
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const handlePrevious = () => {
    const stepOrder: WizardStep[] = 
      deploymentType === 'container' 
        ? ['type', 'basic', 'container', 'review']
        : ['type', 'basic', 'review'];
    
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    const basicData = basicForm.getValues();
    const containerData = containerForm.getValues();
    
    const appData = {
      ...basicData,
      deploymentType,
      ...(deploymentType === 'container' && {
        containerConfig: {
          name: basicData.name,
          description: basicData.description,
          image: {
            visibility: containerData.imageVisibility as 'public' | 'private',
            imageName: containerData.imageName
          },
          resources,
          deployment: {
            type: 'fixed' as const,
            replicas: containerData.replicas
          },
          network: {
            containerPort: containerData.containerPort,
            enableInternetAccess: true,
            protocol: 'http' as const
          },
          advanced: {
            environmentVariables,
            startupCommand: {
              command: startupCommand.command?.filter(cmd => cmd.trim() !== '') || [],
              args: startupCommand.args?.filter(arg => arg.trim() !== '') || [],
              workingDir: startupCommand.workingDir || undefined
            }
          }
        } as ContainerAppConfig
      })
    };

    console.log('创建应用:', appData);
    onSuccess();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'type':
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">选择最适合您应用的部署方式</h3>
              <p className="text-gray-500 text-sm">不同的部署方式适用于不同的场景和需求</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card 
                className={`cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                  deploymentType === 'source' 
                    ? 'ring-2 ring-green-400 bg-green-50 shadow-lg' 
                    : 'hover:shadow-lg hover:bg-gray-50'
                }`}
                onClick={() => setDeploymentType('source')}
              >
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-4 bg-green-100 rounded-xl">
                        <Code className="w-8 h-8 text-green-600" />
                      </div>
                      {deploymentType === 'source' && (
                        <div className="p-2 bg-green-500 rounded-full">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-900">源码部署</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        基于Git仓库构建，提供运行时环境
                      </p>
                      <div className="flex gap-2 pt-2">
                        <Badge variant="outline" className="text-xs px-2 py-1">Git</Badge>
                        <Badge variant="outline" className="text-xs px-2 py-1">传统</Badge>
                        <Badge variant="outline" className="text-xs px-2 py-1">简单</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className={`cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
                  deploymentType === 'container' 
                    ? 'ring-2 ring-blue-400 bg-blue-50 shadow-lg' 
                    : 'hover:shadow-lg hover:bg-gray-50'
                }`}
                onClick={() => setDeploymentType('container')}
              >
                <CardContent className="p-8">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-4 bg-blue-100 rounded-xl">
                        <Container className="w-8 h-8 text-blue-600" />
                      </div>
                      {deploymentType === 'container' && (
                        <div className="p-2 bg-blue-500 rounded-full">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-gray-900">镜像部署</h3>
                        {/* <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-3 py-1">
                          推荐
                        </Badge> */}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        基于容器镜像部署，可选择丰富的已有镜像
                      </p>
                      <div className="flex gap-2 pt-2">
                        <Badge variant="outline" className="text-xs px-2 py-1">Docker</Badge>
                        <Badge variant="outline" className="text-xs px-2 py-1">K8s</Badge>
                        <Badge variant="outline" className="text-xs px-2 py-1">现代化</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'basic':
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">填写应用的基本信息</h3>
              <p className="text-sm text-gray-500">请提供应用的名称、描述{deploymentType === 'source' ? '和Git仓库地址' : ''}</p>
            </div>
            
            <Form {...basicForm}>
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="bg-white border rounded-lg p-8">
                  <div className="space-y-6">
                    <FormField
                      control={basicForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">应用名称 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="请输入应用名称，如：my-awesome-app" 
                              className="mt-1 text-sm h-12"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={basicForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">应用描述</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="简要描述您的应用功能和用途..."
                              rows={4}
                              className="mt-1 text-sm resize-none"
                              {...field} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {deploymentType === 'source' && (
                      <FormField
                        control={basicForm.control}
                        name="gitUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">Git仓库地址</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="https://github.com/username/repository.git"
                                className="mt-1 text-sm h-12"
                                {...field} 
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Form>
          </div>
        );

      case 'container':
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">配置容器化部署参数</h3>
              <p className="text-sm text-gray-500">设置镜像、端口等基本参数，或开启高级配置进行详细设置</p>
            </div>
            
            {/* 配置模式切换 */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {isAdvancedMode ? (
                        <Settings className="w-5 h-5 text-purple-600" />
                      ) : (
                        <Container className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {isAdvancedMode ? '高级配置模式' : '简单配置模式'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {isAdvancedMode 
                          ? '可配置环境变量、启动命令、资源配额、域名等高级选项' 
                          : '只需配置基本的镜像和端口信息，快速部署应用'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border hover:bg-gray-50 transition-colors"
                  >
                    {isAdvancedMode ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-purple-600" />
                        <span className="text-sm font-medium text-purple-600">高级模式</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">简单模式</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <Form {...containerForm}>
              <div className="max-w-4xl mx-auto space-y-8">
                {/* 基本配置 */}
                <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-6 flex items-center gap-2">
                    <Container className="w-5 h-5 text-blue-500" />
                    基本配置
                  </h4>
                  
                  <div className={`grid grid-cols-1 ${isAdvancedMode ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                    <FormField
                      control={containerForm.control}
                      name="imageName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">容器镜像 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="例如：nginx, node:18-alpine"
                              className="mt-1 text-sm h-11"
                              {...field} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={containerForm.control}
                      name="containerPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">容器端口 *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              placeholder="80"
                              className="mt-1 text-sm h-11"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 80)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {isAdvancedMode && (
                      <FormField
                        control={containerForm.control}
                        name="replicas"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium text-gray-700">副本数量</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min="1"
                                max="10"
                                placeholder="1"
                                className="mt-1 text-sm h-11"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* 环境变量配置 */}
                {isAdvancedMode && (
                  <div className="bg-white border rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-green-500" />
                      环境变量
                    </h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEnvironmentVariable}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      添加环境变量
                    </Button>
                  </div>
                  
                  {environmentVariables.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>暂无环境变量</p>
                      <p className="text-sm">点击上方按钮添加环境变量</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {environmentVariables.map((env, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                              placeholder="变量名 (如: NODE_ENV)"
                              value={env.key}
                              onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                              className="text-sm h-10"
                            />
                            <Input
                              placeholder="变量值 (如: production)"
                              value={env.value}
                              onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                              className="text-sm h-10"
                            />
                            <select
                              value={env.type}
                              onChange={(e) => updateEnvironmentVariable(index, 'type', e.target.value as 'plain' | 'secret' | 'configmap')}
                              className="text-sm h-10 px-3 border border-gray-300 rounded-md bg-white"
                            >
                              <option value="plain">普通变量</option>
                              <option value="secret">密钥变量</option>
                              <option value="configmap">配置映射</option>
                            </select>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeEnvironmentVariable(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                )}

                {/* 启动命令配置 */}
                {isAdvancedMode && (
                  <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-6 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-purple-500" />
                    启动命令
                  </h4>
                  
                  <div className="space-y-6">
                    {/* 工作目录 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        工作目录 (可选)
                      </label>
                      <Input
                        placeholder="例如: /app, /usr/src/app"
                        value={startupCommand.workingDir || ''}
                        onChange={(e) => updateStartupCommand('workingDir', e.target.value)}
                        className="text-sm h-11"
                      />
                    </div>

                    {/* 启动命令 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          启动命令 (可选)
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCommandArg('command')}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          添加命令
                        </Button>
                      </div>
                      {startupCommand.command && startupCommand.command.length > 0 ? (
                        <div className="space-y-2">
                          {startupCommand.command.map((cmd, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                placeholder="例如: node, python, /bin/sh"
                                value={cmd}
                                onChange={(e) => updateCommandArg('command', index, e.target.value)}
                                className="flex-1 text-sm h-10"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeCommandArg('command', index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                          <Terminal className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">使用默认启动命令</p>
                        </div>
                      )}
                    </div>

                    {/* 启动参数 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          启动参数 (可选)
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addCommandArg('args')}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          添加参数
                        </Button>
                      </div>
                      {startupCommand.args && startupCommand.args.length > 0 ? (
                        <div className="space-y-2">
                          {startupCommand.args.map((arg, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                placeholder="例如: --port=3000, --env=production"
                                value={arg}
                                onChange={(e) => updateCommandArg('args', index, e.target.value)}
                                className="flex-1 text-sm h-10"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeCommandArg('args', index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                          <Terminal className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">无启动参数</p>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                )}

                {/* 资源配额 */}
                {isAdvancedMode && (
                  <div className="bg-white border rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-6 flex items-center gap-2">
                    <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    资源配额
                  </h4>
                  <ResourceQuotaComponent
                    value={resources}
                    onChange={setResources}
                    className=""
                  />
                  </div>
                )}
              </div>
            </Form>
          </div>
        );

      case 'review':
        const basicData = basicForm.getValues();
        const containerData = containerForm.getValues();
        const { deploymentYaml, serviceYaml } = generateKubernetesYaml();
        return (
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">检查配置并创建应用</h3>
              <p className="text-sm text-gray-500">请确认以下配置信息无误，可复制 YAML 文件直接部署</p>
            </div>
            
            <div className="max-w-6xl mx-auto space-y-6">
              {/* 基本信息卡片 */}
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {deploymentType === 'source' ? (
                        <Code className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Container className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-3">基本信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">应用名称:</span>
                            <span className="font-medium">{basicData.name}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">部署方式:</span>
                            <Badge variant={deploymentType === 'container' ? 'default' : 'secondary'}>
                              {deploymentType === 'source' ? '源码部署' : '容器部署'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          {basicData.description && (
                            <div className="text-sm">
                              <span className="text-gray-600">描述:</span>
                              <p className="mt-1 text-gray-700 bg-gray-50 p-2 rounded text-xs">
                                {basicData.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kubernetes YAML 配置预览 */}
              {deploymentType === 'container' && (
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <FileText className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-4">Kubernetes YAML 配置</h4>
                        
                        {/* Deployment YAML */}
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-700">Deployment 配置</h5>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(deploymentYaml)}
                                className="flex items-center gap-2 text-xs"
                              >
                                <Copy className="w-3 h-3" />
                                复制
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono">
                              <code>{deploymentYaml}</code>
                            </pre>
                          </div>
                          
                          {/* Service YAML */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-gray-700">Service 配置</h5>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(serviceYaml)}
                                className="flex items-center gap-2 text-xs"
                              >
                                <Copy className="w-3 h-3" />
                                复制
                              </Button>
                            </div>
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-32 overflow-y-auto font-mono">
                              <code>{serviceYaml}</code>
                            </pre>
                          </div>
                          
                          {/* 一键复制所有 YAML */}
                          <div className="flex justify-center pt-4 border-t">
                            <Button
                              type="button"
                              variant="default"
                              onClick={() => copyToClipboard(`${deploymentYaml}\n---\n${serviceYaml}`)}
                              className="flex items-center gap-2"
                            >
                              <Copy className="w-4 h-4" />
                              复制所有 YAML 配置
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}



              {/* 容器配置卡片 */}
              {deploymentType === 'container' && (
                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Container className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <h4 className="font-semibold text-gray-900">容器配置</h4>
                          {isAdvancedMode && (
                            <Badge variant="secondary" className="text-xs">
                              高级模式
                            </Badge>
                          )}
                        </div>
                        <div className={`grid grid-cols-1 ${isAdvancedMode ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
                          <div className="space-y-2">
                            <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">镜像配置</h5>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">镜像名:</span>
                                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{containerData.imageName}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">端口:</span>
                                <span className="font-medium">{containerData.containerPort}</span>
                              </div>
                              {isAdvancedMode && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">副本:</span>
                                  <span className="font-medium">{containerData.replicas}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {isAdvancedMode && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">资源配额</h5>
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">CPU:</span>
                                  <span className="font-medium">{resources.cpu} 核</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">内存:</span>
                                  <span className="font-medium">{resources.memory} MB</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">存储:</span>
                                  <span className="font-medium">{resources.storage || 0} GB</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isAdvancedMode && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">环境变量</h5>
                              <div className="space-y-1">
                                {environmentVariables.length > 0 ? (
                                  <div className="max-h-24 overflow-y-auto">
                                    {environmentVariables.map((env, index) => (
                                      <div key={index} className="flex justify-between text-xs py-1">
                                        <span className="text-gray-600 truncate">{env.key}:</span>
                                        <span className="font-mono bg-gray-100 px-1 rounded text-xs max-w-20 truncate">{env.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">无环境变量</span>
                                )}
                              </div>
                            </div>
                          )}
                          {isAdvancedMode && (
                            <div className="space-y-2">
                              <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">启动命令</h5>
                              <div className="space-y-1">
                                {startupCommand.workingDir && (
                                  <div className="text-xs">
                                    <span className="text-gray-600">工作目录:</span>
                                    <span className="font-mono bg-gray-100 px-1 rounded ml-1">{startupCommand.workingDir}</span>
                                  </div>
                                )}
                                {startupCommand.command && startupCommand.command.length > 0 && (
                                  <div className="text-xs">
                                    <span className="text-gray-600">命令:</span>
                                    <div className="font-mono bg-gray-100 px-1 rounded mt-1 text-xs max-h-16 overflow-y-auto">
                                      {startupCommand.command.join(' ')}
                                    </div>
                                  </div>
                                )}
                                {startupCommand.args && startupCommand.args.length > 0 && (
                                  <div className="text-xs">
                                    <span className="text-gray-600">参数:</span>
                                    <div className="font-mono bg-gray-100 px-1 rounded mt-1 text-xs max-h-16 overflow-y-auto">
                                      {startupCommand.args.join(' ')}
                                    </div>
                                  </div>
                                )}
                                {(!startupCommand.workingDir && (!startupCommand.command || startupCommand.command.length === 0) && (!startupCommand.args || startupCommand.args.length === 0)) && (
                                  <span className="text-xs text-gray-400">使用默认命令</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStepIndicator = () => {
    const activeSteps = deploymentType === 'container' 
      ? ['type', 'basic', 'container', 'review'] as WizardStep[]
      : ['type', 'basic', 'review'] as WizardStep[];

    return (
      <div className="flex items-center justify-center mb-8">
        {activeSteps.map((step, index) => (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isStepCompleted(step) 
                  ? 'bg-green-500 text-white' 
                  : step === currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}>
                {isStepCompleted(step) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className="text-xs mt-1 text-gray-600">{steps[step].title}</span>
            </div>
            {index < activeSteps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${
                isStepCompleted(activeSteps[index + 1]) ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl sm:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col"> 
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-2xl font-semibold">创建新应用</DialogTitle>
          <p className="text-gray-500 text-sm">{steps[currentStep].description}</p>
        </DialogHeader>

        <div className="flex-shrink-0 mb-6">
          {renderStepIndicator()}
        </div>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="min-h-[500px] pb-4">
            {renderStepContent()}
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t bg-white flex-shrink-0">
          <Button
            variant="outline"
            onClick={currentStep === 'type' ? onClose : handlePrevious}
            className="px-6 py-2"
          >
            {currentStep === 'type' ? (
              '取消'
            ) : (
              <>
                <ArrowLeft className="w-4 h-4 mr-2" />
                上一步
              </>
            )}
          </Button>

          <Button
            onClick={currentStep === 'review' ? handleSubmit : handleNext}
            disabled={!canProceed()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700"
          >
            {currentStep === 'review' ? (
              '生成 YAML 配置'
            ) : (
              <>
                下一步
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppCreationWizard;
