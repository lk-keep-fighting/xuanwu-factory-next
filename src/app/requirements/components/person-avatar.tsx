import { cn } from '@/lib/utils'
import { type RequirementPersonRef } from '@/types/requirement'

const getInitial = (name: string) => {
  if (!name) return '成'
  const trimmed = name.trim()
  if (trimmed.length === 0) return '成'
  return trimmed[0]
}

export function PersonAvatar({
  person,
  className
}: {
  person: RequirementPersonRef
  className?: string
}) {
  const initial = getInitial(person.name)
  const backgroundColor = person.avatarColor ?? '#475569'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor }}
      >
        {initial}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-medium text-gray-900">{person.name}</div>
        {person.title ? <div className="text-xs text-gray-500">{person.title}</div> : null}
      </div>
    </div>
  )
}
