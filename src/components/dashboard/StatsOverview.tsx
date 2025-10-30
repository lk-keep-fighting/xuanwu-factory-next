import React from 'react';
import { Card } from '@/components/ui';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  trend,
  trendValue,
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <span className="text-green-500">↗</span>;
      case 'down':
        return <span className="text-red-500">↘</span>;
      case 'stable':
        return <span className="text-gray-500">→</span>;
      default:
        return null;
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        {trend && trendValue && (
          <div className="flex items-center text-sm">
            {getTrendIcon()}
            <span className="ml-1">{trendValue}</span>
          </div>
        )}
      </div>
    </Card>
  );
};

const StatsOverview: React.FC = () => {
  const stats = [
    {
      title: '运行中应用',
      value: 24,
      description: '活跃应用数量',
      trend: 'up' as const,
      trendValue: '+3',
    },
    {
      title: '今日构建',
      value: 18,
      description: '成功构建次数',
      trend: 'up' as const,
      trendValue: '+5',
    },
    {
      title: '部署环境',
      value: 12,
      description: '可用环境数',
      trend: 'stable' as const,
      trendValue: '0',
    },
    {
      title: '测试通过率',
      value: '96%',
      description: '最近一周平均',
      trend: 'up' as const,
      trendValue: '+2%',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          description={stat.description}
          trend={stat.trend}
          trendValue={stat.trendValue}
        />
      ))}
    </div>
  );
};

export default StatsOverview;