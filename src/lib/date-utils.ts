/**
 * Utility functions for date and time formatting
 */

/**
 * Format date/time for display
 */
export function formatDateTime(value?: string): string {
  if (!value) return '-'
  
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return value
  }
}

/**
 * Format duration between two timestamps
 */
export function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '-'
  
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diff = endDate.getTime() - startDate.getTime()

  if (!Number.isFinite(diff) || diff <= 0) {
    return '小于 1 秒'
  }

  const totalSeconds = Math.floor(diff / 1000)
  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`
  }

  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (totalMinutes < 60) {
    return seconds ? `${totalMinutes} 分 ${seconds} 秒` : `${totalMinutes} 分`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts = [`${hours} 小时`]

  if (minutes) {
    parts.push(`${minutes} 分`)
  }

  if (seconds) {
    parts.push(`${seconds} 秒`)
  }

  return parts.join(' ')
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return '-'
  
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 0) return '刚刚'
    
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return '刚刚'
    
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} 分钟前`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时前`
    
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} 天前`
    
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} 个月前`
    
    const years = Math.floor(months / 12)
    return `${years} 年前`
  } catch {
    return timestamp
  }
}
