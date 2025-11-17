import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type RequirementPriority } from '@/types/requirement'

const PRIORITY_META: Record<RequirementPriority, { label: string; className: string; dotClass: string }> = {
  HIGH: {
    label: '高',
    className: 'bg-rose-50 text-rose-700 border border-rose-200',
    dotClass: 'bg-rose-500'
  },
  MEDIUM: {
    label: '中',
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
    dotClass: 'bg-orange-400'
  },
  LOW: {
    label: '低',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-400'
  }
}

export const requirementPriorityMeta = PRIORITY_META

export function RequirementPriorityBadge({
  priority,
  className
}: {
  priority: RequirementPriority
  className?: string
}) {
  const meta = PRIORITY_META[priority]
  return (
    <Badge className={cn('gap-1 px-2.5 py-1 text-xs font-medium', meta.className, className)}>
      <span className={cn('size-2 rounded-full', meta.dotClass)} />
      优先级：{meta.label}
    </Badge>
  )
}
