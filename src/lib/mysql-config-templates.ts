/**
 * MySQL 配置模板
 */

export interface MySQLConfig {
  lower_case_table_names?: 0 | 1 | 2
  max_connections?: number
  innodb_buffer_pool_size?: string
  character_set_server?: string
  collation_server?: string
  innodb_log_file_size?: string
  innodb_flush_log_at_trx_commit?: 0 | 1 | 2
  innodb_flush_method?: string
  thread_cache_size?: number
  query_cache_size?: string
  custom_config?: string
}

export interface MySQLConfigTemplate {
  name: string
  description: string
  config: MySQLConfig
  warnings?: string[]
}

export const MYSQL_CONFIG_TEMPLATES: Record<string, MySQLConfigTemplate> = {
  default: {
    name: '默认配置',
    description: 'MySQL 8.0 标准配置，适用于大多数场景',
    config: {
      lower_case_table_names: 0,
      max_connections: 151,
      character_set_server: 'utf8mb4',
      collation_server: 'utf8mb4_unicode_ci',
      innodb_buffer_pool_size: '128M'
    }
  },
  'case-insensitive': {
    name: '不区分大小写（Windows 兼容）',
    description: '适用于从 Windows 迁移或需要表名不区分大小写的场景',
    config: {
      lower_case_table_names: 1,
      max_connections: 200,
      character_set_server: 'utf8mb4',
      collation_server: 'utf8mb4_unicode_ci',
      innodb_buffer_pool_size: '256M'
    },
    warnings: [
      'lower_case_table_names=1 必须在初始化前设置，部署后无法修改',
      '此配置会将所有表名转换为小写存储'
    ]
  },
  'high-performance': {
    name: '高性能配置',
    description: '适用于生产环境的高性能配置（需要较大内存）',
    config: {
      lower_case_table_names: 0,
      max_connections: 500,
      character_set_server: 'utf8mb4',
      collation_server: 'utf8mb4_unicode_ci',
      innodb_buffer_pool_size: '1G',
      innodb_log_file_size: '256M',
      innodb_flush_log_at_trx_commit: 2,
      innodb_flush_method: 'O_DIRECT',
      thread_cache_size: 100,
      query_cache_size: '64M'
    },
    warnings: [
      '此配置需要至少 2GB 内存',
      '请确保资源配额足够'
    ]
  },
  custom: {
    name: '自定义配置',
    description: '完全自定义 my.cnf 配置文件',
    config: {
      custom_config: `[mysqld]
# 基础配置
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

# 连接配置
max_connections=151

# 表名大小写（0=区分大小写，1=不区分大小写）
# lower_case_table_names=1

# InnoDB 配置
innodb_buffer_pool_size=128M

# 日志配置
slow_query_log=1
long_query_time=2
`
    }
  }
}

/**
 * 生成 my.cnf 配置文件内容
 */
export function generateMyCnfContent(config: MySQLConfig): string {
  if (config.custom_config) {
    return config.custom_config
  }

  const lines: string[] = ['[mysqld]', '']

  // 基础配置
  if (config.character_set_server) {
    lines.push(`# 字符集配置`)
    lines.push(`character-set-server=${config.character_set_server}`)
    if (config.collation_server) {
      lines.push(`collation-server=${config.collation_server}`)
    }
    lines.push('')
  }

  // 连接配置
  if (config.max_connections) {
    lines.push(`# 连接配置`)
    lines.push(`max_connections=${config.max_connections}`)
    if (config.thread_cache_size) {
      lines.push(`thread_cache_size=${config.thread_cache_size}`)
    }
    lines.push('')
  }

  // 表名大小写（重要：初始化配置）
  if (config.lower_case_table_names !== undefined) {
    lines.push(`# 表名大小写（初始化配置，部署后无法修改）`)
    lines.push(`lower_case_table_names=${config.lower_case_table_names}`)
    lines.push('')
  }

  // InnoDB 配置
  const hasInnodbConfig = 
    config.innodb_buffer_pool_size || 
    config.innodb_log_file_size || 
    config.innodb_flush_log_at_trx_commit !== undefined ||
    config.innodb_flush_method

  if (hasInnodbConfig) {
    lines.push(`# InnoDB 配置`)
    if (config.innodb_buffer_pool_size) {
      lines.push(`innodb_buffer_pool_size=${config.innodb_buffer_pool_size}`)
    }
    if (config.innodb_log_file_size) {
      lines.push(`innodb_log_file_size=${config.innodb_log_file_size}`)
    }
    if (config.innodb_flush_log_at_trx_commit !== undefined) {
      lines.push(`innodb_flush_log_at_trx_commit=${config.innodb_flush_log_at_trx_commit}`)
    }
    if (config.innodb_flush_method) {
      lines.push(`innodb_flush_method=${config.innodb_flush_method}`)
    }
    lines.push('')
  }

  // 查询缓存
  if (config.query_cache_size) {
    lines.push(`# 查询缓存`)
    lines.push(`query_cache_size=${config.query_cache_size}`)
    lines.push('')
  }

  // 日志配置（使用 MySQL 默认路径，避免权限问题）
  lines.push(`# 日志配置`)
  lines.push(`slow_query_log=1`)
  lines.push(`long_query_time=2`)

  return lines.join('\n')
}

/**
 * 验证 MySQL 配置
 */
export function validateMySQLConfig(config: MySQLConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (config.max_connections !== undefined) {
    if (config.max_connections < 1 || config.max_connections > 10000) {
      errors.push('max_connections 必须在 1-10000 之间')
    }
  }

  if (config.lower_case_table_names !== undefined) {
    if (![0, 1, 2].includes(config.lower_case_table_names)) {
      errors.push('lower_case_table_names 必须是 0、1 或 2')
    }
  }

  if (config.innodb_buffer_pool_size) {
    const match = config.innodb_buffer_pool_size.match(/^(\d+)(M|G|K)?$/i)
    if (!match) {
      errors.push('innodb_buffer_pool_size 格式无效，例如：128M、1G')
    }
  }

  if (config.thread_cache_size !== undefined) {
    if (config.thread_cache_size < 0 || config.thread_cache_size > 1000) {
      errors.push('thread_cache_size 必须在 0-1000 之间')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
