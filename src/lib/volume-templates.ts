/**
 * 卷挂载模板库
 * 为常用镜像提供预设的挂载配置
 */

export interface VolumeTemplate {
  container_path: string
  description: string
  read_only?: boolean
  required?: boolean
}

export interface ImageVolumeTemplate {
  image: string
  displayName: string
  volumes: VolumeTemplate[]
  description?: string
}

/**
 * 常用镜像的卷挂载模板
 */
export const VOLUME_TEMPLATES: ImageVolumeTemplate[] = [
  {
    image: 'nginx',
    displayName: 'Nginx',
    description: 'Web 服务器',
    volumes: [
      {
        container_path: '/usr/share/nginx/html',
        description: '网站根目录（HTML/静态文件）',
        required: true
      },
      {
        container_path: '/etc/nginx/conf.d',
        description: '配置文件目录',
        required: true
      },
      {
        container_path: '/var/log/nginx',
        description: '日志目录'
      },
      {
        container_path: '/etc/nginx/nginx.conf',
        description: '主配置文件',
        read_only: true
      }
    ]
  },
  {
    image: 'httpd',
    displayName: 'Apache HTTP Server',
    description: 'Apache Web 服务器',
    volumes: [
      {
        container_path: '/usr/local/apache2/htdocs',
        description: '网站根目录',
        required: true
      },
      {
        container_path: '/usr/local/apache2/conf',
        description: '配置目录'
      },
      {
        container_path: '/usr/local/apache2/logs',
        description: '日志目录'
      }
    ]
  },
  {
    image: 'mysql',
    displayName: 'MySQL',
    description: 'MySQL 数据库',
    volumes: [
      {
        container_path: '/var/lib/mysql',
        description: '数据目录',
        required: true
      },
      {
        container_path: '/etc/mysql/conf.d',
        description: '配置目录'
      },
      {
        container_path: '/docker-entrypoint-initdb.d',
        description: '初始化脚本目录'
      }
    ]
  },
  {
    image: 'postgres',
    displayName: 'PostgreSQL',
    description: 'PostgreSQL 数据库',
    volumes: [
      {
        container_path: '/var/lib/postgresql/data',
        description: '数据目录',
        required: true
      },
      {
        container_path: '/docker-entrypoint-initdb.d',
        description: '初始化脚本目录'
      }
    ]
  },
  {
    image: 'redis',
    displayName: 'Redis',
    description: 'Redis 缓存数据库',
    volumes: [
      {
        container_path: '/data',
        description: '数据目录',
        required: true
      },
      {
        container_path: '/usr/local/etc/redis/redis.conf',
        description: '配置文件',
        read_only: true
      }
    ]
  },
  {
    image: 'mongodb',
    displayName: 'MongoDB',
    description: 'MongoDB 文档数据库',
    volumes: [
      {
        container_path: '/data/db',
        description: '数据目录',
        required: true
      },
      {
        container_path: '/data/configdb',
        description: '配置目录'
      }
    ]
  },
  {
    image: 'mariadb',
    displayName: 'MariaDB',
    description: 'MariaDB 数据库',
    volumes: [
      {
        container_path: '/var/lib/mysql',
        description: '数据目录',
        required: true
      },
      {
        container_path: '/etc/mysql/conf.d',
        description: '配置目录'
      }
    ]
  }
]

/**
 * 根据镜像名称查找模板
 */
export function findVolumeTemplate(imageName: string): ImageVolumeTemplate | undefined {
  if (!imageName) return undefined
  
  const normalized = imageName.toLowerCase().trim()
  
  // 精确匹配
  let template = VOLUME_TEMPLATES.find(t => normalized === t.image)
  if (template) return template
  
  // 包含匹配（如 nginx:alpine -> nginx）
  template = VOLUME_TEMPLATES.find(t => normalized.includes(t.image))
  if (template) return template
  
  // 反向匹配（如 bitnami/nginx -> nginx）
  return VOLUME_TEMPLATES.find(t => normalized.includes(t.image))
}

/**
 * 获取推荐的卷挂载配置
 */
export function getRecommendedVolumes(imageName: string) {
  const template = findVolumeTemplate(imageName)
  if (!template) return []
  
  return template.volumes.filter(v => v.required)
}

/**
 * 生成 NFS 子路径（基于服务名和容器路径）
 * @param serviceName 服务名
 * @param containerPath 容器路径
 * @returns NFS 子路径，格式：{serviceName}/{containerPath 规范化}
 */
export function generateNFSSubpath(
  serviceName: string,
  containerPath: string
): string {
  if (!containerPath) return serviceName
  
  // 移除前导 '/'
  const cleanPath = containerPath.replace(/^\//, '')
  
  // 检查是否是文件路径（包含文件扩展名，但排除常见的目录名模式）
  // 文件扩展名通常是 1-10 个字符，且不包含数字开头的情况（如 conf.d）
  const isFile = /\.[a-zA-Z][a-zA-Z0-9]{0,9}$/.test(cleanPath) && 
                 !/\.(d|bak|tmp|old|new)$/.test(cleanPath)
  
  if (isFile) {
    // 如果是文件，分离目录和文件名
    const lastSlashIndex = cleanPath.lastIndexOf('/')
    if (lastSlashIndex === -1) {
      // 文件在根目录，直接放在服务名目录下
      return `${serviceName}/${cleanPath}`
    } else {
      // 文件在子目录中，目录部分替换 '/' 为 '-'，文件名保持不变
      const dirPath = cleanPath.substring(0, lastSlashIndex).replace(/\//g, '-')
      const fileName = cleanPath.substring(lastSlashIndex + 1)
      return `${serviceName}/${dirPath}/${fileName}`
    }
  } else {
    // 如果是目录，替换所有 '/' 为 '-'
    const normalized = cleanPath.replace(/\//g, '-')
    return `${serviceName}/${normalized}`
  }
}
