import React from 'react';
import { Card } from '@/components/ui';

interface DashboardSectionProps {
  title: string;
  variant?: 'wms' | 'meixin' | 'industrial' | 'engineering';
  children: React.ReactNode;
  className?: string;
}

const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  variant = 'engineering',
  children,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'wms':
        return {
          cardClass: 'bg-green-50 border-green-200',
          headerClass: 'bg-green-500 text-white',
        };
      case 'meixin':
        return {
          cardClass: 'bg-gray-100 border-gray-300',
          headerClass: 'bg-gray-500 text-white',
        };
      case 'industrial':
        return {
          cardClass: 'bg-gray-50 border-gray-300',
          headerClass: 'bg-gray-400 text-white',
        };
      case 'engineering':
        return {
          cardClass: 'bg-gray-50 border-gray-300',
          headerClass: 'bg-gray-400 text-white',
        };
      default:
        return {
          cardClass: 'bg-white border-gray-200',
          headerClass: 'bg-gray-500 text-white',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Card className={`p-6 ${styles.cardClass} ${className}`}>
      <div className="mb-6">
        <span className={`inline-block px-4 py-2 rounded text-sm font-medium ${styles.headerClass}`}>
          {title}
        </span>
      </div>
      {children}
    </Card>
  );
};

export default DashboardSection;