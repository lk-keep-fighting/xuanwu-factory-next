import React from 'react';

interface ApplicationCardProps {
  title: string;
  description?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  variant?: 'wms' | 'meixin' | 'industrial' | 'engineering';
  onClick?: () => void;
  className?: string;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  title,
  description,
  status,
  variant = 'engineering',
  onClick,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'wms':
        return 'hover:bg-green-50 hover:border-green-300';
      case 'meixin':
        return 'hover:bg-gray-50 hover:border-gray-400';
      case 'industrial':
        return 'hover:bg-blue-50 hover:border-blue-300';
      case 'engineering':
        return 'hover:bg-orange-50 hover:border-orange-300';
      default:
        return 'hover:bg-gray-50';
    }
  };

  const getStatusIndicator = () => {
    if (!status) return null;
    
    const statusStyles = {
      active: 'bg-green-500',
      inactive: 'bg-gray-400',
      maintenance: 'bg-yellow-500',
    };

    return (
      <div className="absolute top-2 right-2">
        <div 
          className={`w-2 h-2 rounded-full ${statusStyles[status]}`}
          title={status}
        />
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white border-2 border-gray-800 rounded-lg p-4 
        cursor-pointer transition-all duration-200 
        min-h-[80px] flex items-center justify-center text-center
        hover:shadow-md hover:scale-105 active:scale-95
        ${getVariantStyles()}
        ${className}
      `}
    >
      {getStatusIndicator()}
      <div className="w-full">
        <div className="font-medium text-sm leading-tight mb-1">
          {title}
        </div>
        {description && (
          <div className="text-xs text-gray-600 leading-tight">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplicationCard;