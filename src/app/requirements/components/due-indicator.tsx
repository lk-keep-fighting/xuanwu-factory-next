import { CalendarCheck, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { type RequirementStatus } from '@/types/requirement'

const formatDate = (value: string) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function RequirementDueIndicator({
  dueAt,
  status,
  remainingDays,
  className
}: {
  dueAt?: string
  status: RequirementStatus
  remainingDays?: number
  className?: string
}) {
  if (!dueAt) {
    return <span className={cn('text-xs text-gray-400', className)}>未设置截止日期</span>
  }

  const formattedDate = formatDate(dueAt)
  const isCompleted = status === 'DONE'
  const overdue = typeof remainingDays === 'number' ? remainingDays < 0 : false

  let badgeText = '已完成'
  let badgeClass = 'text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200'

  if (!isCompleted) {
    if (overdue) {
      const days = Math.abs(Math.min(remainingDays ?? 0, -1))
      badgeText = days > 0 ? `已逾期 ${days} 天` : '已逾期'
      badgeClass = 'text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200'
    } else if (remainingDays === 0) {
      badgeText = '今日截止'
      badgeClass = 'text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200'
    } else if (typeof remainingDays === 'number') {
      badgeText = `剩余 ${remainingDays} 天`
      badgeClass = 'text-xs font-medium text-sky-600 bg-sky-50 border border-sky-200'
    } else {
      badgeText = '进行中'
      badgeClass = 'text-xs font-medium text-sky-600 bg-sky-50 border border-sky-200'
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1 text-xs text-gray-600">
        <CalendarCheck className="h-3.5 w-3.5 text-gray-400" />
        <span>{formattedDate}</span>
      </div>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 border', badgeClass)}>
        <Clock className="h-3 w-3" />
        {badgeText}
      </span>
    </div>
  )
}
