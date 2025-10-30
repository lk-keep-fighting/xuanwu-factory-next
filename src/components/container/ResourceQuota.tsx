import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Cpu, MemoryStick, HardDrive, DollarSign } from 'lucide-react';
import type { ResourceQuota, CostEstimate } from '@/types/container';
import { containerSvc } from '@/service/containerSvc';

interface ResourceQuotaProps {
  value: ResourceQuota;
  onChange: (resources: ResourceQuota) => void;
  className?: string;
}

const ResourceQuotaComponent: React.FC<ResourceQuotaProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState(false);

  // 计算成本估算
  useEffect(() => {
    const calculateCost = async () => {
      setLoading(true);
      try {
        const estimate = await containerSvc.calculateCost(value);
        setCostEstimate(estimate);
      } catch (error) {
        console.error('计算成本失败:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateCost();
  }, [value]);

  // CPU滑块配置
  const cpuConfig = {
    min: 0.1,
    max: 8,
    step: 0.1,
    marks: [0.1, 0.2, 0.5, 1, 2, 3, 4, 8]
  };

  // 内存滑块配置 (MB)
  const memoryConfig = {
    min: 128,
    max: 16384, // 16GB
    step: 128,
    marks: [128, 256, 512, 1024, 2048, 4096, 8192, 16384]
  };

  // 存储滑块配置 (GB)
  const storageConfig = {
    min: 0,
    max: 100,
    step: 1,
    marks: [0, 1, 5, 10, 20, 50, 100]
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} G`;
    }
    return `${mb} M`;
  };

  const handleCpuChange = (values: number[]) => {
    onChange({ ...value, cpu: values[0] });
  };

  const handleMemoryChange = (values: number[]) => {
    onChange({ ...value, memory: values[0] });
  };

  const handleStorageChange = (values: number[]) => {
    onChange({ ...value, storage: values[0] });
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* CPU配置 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-green-600" />
              CPU
            </Label>
            <Badge variant="secondary">
              {value.cpu.toFixed(1)} Core{value.cpu > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="px-3">
            <Slider
              value={[value.cpu]}
              onValueChange={handleCpuChange}
              min={cpuConfig.min}
              max={cpuConfig.max}
              step={cpuConfig.step}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {cpuConfig.marks.map((mark) => (
                <span key={mark}>{mark}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 内存配置 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-blue-600" />
              Memory
            </Label>
            <Badge variant="secondary">
              {formatMemory(value.memory)}
            </Badge>
          </div>
          <div className="px-3">
            <Slider
              value={[value.memory]}
              onValueChange={handleMemoryChange}
              min={memoryConfig.min}
              max={memoryConfig.max}
              step={memoryConfig.step}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {memoryConfig.marks.map((mark) => (
                <span key={mark}>{formatMemory(mark)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 存储配置 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-600" />
              Storage
            </Label>
            <Badge variant="secondary">
              {value.storage === 0 ? 'None' : `${value.storage} GB`}
            </Badge>
          </div>
          <div className="px-3">
            <Slider
              value={[value.storage]}
              onValueChange={handleStorageChange}
              min={storageConfig.min}
              max={storageConfig.max}
              step={storageConfig.step}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {storageConfig.marks.map((mark) => (
                <span key={mark}>{mark === 0 ? 'None' : `${mark}GB`}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 成本估算 */}
      {/* <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="w-4 h-4 text-gray-600" />
            The Estimated Cost
            <Badge variant="outline" className="text-xs">
              /{costEstimate?.period || 'day'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : costEstimate ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">CPU:</span>
                </div>
                <span className="text-sm font-mono">
                  ${costEstimate.cpu.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Memory:</span>
                </div>
                <span className="text-sm font-mono">
                  ${costEstimate.memory.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm">Storage:</span>
                </div>
                <span className="text-sm font-mono">
                  ${costEstimate.storage.toFixed(3)}
                </span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-800"></div>
                    <span className="text-sm">Total:</span>
                  </div>
                  <span className="text-sm font-mono">
                    ${costEstimate.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              无法计算成本估算
            </div>
          )}
        </CardContent>
      </Card> */}
    </div>
  );
};

export default ResourceQuotaComponent;
