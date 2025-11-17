import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type RequirementStatus } from '@/types/requirement'

const STATUS_META: Record<RequirementStatus, { label: string; className: string; dotClass: string }> = {
  DRAFT: {
    label: '草稿',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotClass: 'bg-slate-400'
  },
  TODO: {
    label: '待执行',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    dotClass: 'bg-amber-500'
  },
  IN_PROGRESS: {
    label: '执行中',
    className: 'bg-sky-50 text-sky-700 border border-sky-200',
    dotClass: 'bg-sky-500'
  },
  DONE: {
    label: '已完成',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  CANCELED: {
    label: '已取消',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
    dotClass: 'bg-gray-400'
  }
}

export const requirementStatusMeta = STATUS_META

export function RequirementStatusBadge({
  status,
  className
}: {
  status: RequirementStatus
  className?: string
}) {
  const meta = STATUS_META[status]

  return (
    <Badge className={cn('gap-1 px-2.5 py-1 text-xs font-medium', meta.className, className)}>
      <span className={cn('size-2 rounded-full', meta.dotClass)} />
      {meta.label}
    </Badge>
  )
}
