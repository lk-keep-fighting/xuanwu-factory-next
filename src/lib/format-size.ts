/**
 * 格式化文件大小
 * 
 * @param bytes 字节数
 * @returns 格式化的字符串，如 "1.5 MB", "4.0 KB"
 */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) {
    return '-'
  }

  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)

  // 根据大小决定小数位数
  let decimals = 2
  if (i === 0) {
    // 字节不需要小数
    decimals = 0
  } else if (value >= 100) {
    // 大于100的数字只保留1位小数
    decimals = 1
  }

  return `${value.toFixed(decimals)} ${units[i]}`
}
