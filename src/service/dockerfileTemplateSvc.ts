import { prisma } from '@/lib/prisma'
import type { DockerfileTemplate } from '@prisma/client'

export interface DockerfileTemplateData {
  id: string
  name: string
  description: string
  category: string
  baseImage: string
  workdir: string
  copyFiles: string[]
  installCommands: string[]
  buildCommands: string[]
  runCommand: string
  exposePorts: number[]
  envVars: Record<string, string>
  dockerfile: string
}

export interface CreateDockerfileTemplateRequest {
  id: string
  name: string
  description: string
  category: string
  base_image: string
  workdir?: string
  copy_files?: string[]
  install_commands?: string[]
  build_commands?: string[]
  run_command: string
  expose_ports?: number[]
  env_vars?: Record<string, string>
  dockerfile_content: string
  created_by?: string
}

export interface UpdateDockerfileTemplateRequest {
  name?: string
  description?: string
  category?: string
  base_image?: string
  workdir?: string
  copy_files?: string[]
  install_commands?: string[]
  build_commands?: string[]
  run_command?: string
  expose_ports?: number[]
  env_vars?: Record<string, string>
  dockerfile_content?: string
  is_active?: boolean
  updated_by?: string
}

/**
 * Dockerfile 模板管理服务
 */
export const dockerfileTemplateSvc = {
  /**
   * 获取所有活跃的模板
   */
  async getAllTemplates(): Promise<DockerfileTemplateData[]> {
    const templates = await prisma.dockerfileTemplate.findMany({
      where: { is_active: true },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    return templates.map(this.transformTemplate)
  },

  /**
   * 根据分类获取模板
   */
  async getTemplatesByCategory(category: string): Promise<DockerfileTemplateData[]> {
    const templates = await prisma.dockerfileTemplate.findMany({
      where: { 
        category,
        is_active: true 
      },
      orderBy: { name: 'asc' }
    })

    return templates.map(this.transformTemplate)
  },

  /**
   * 根据ID获取模板
   */
  async getTemplateById(id: string): Promise<DockerfileTemplateData | null> {
    const template = await prisma.dockerfileTemplate.findUnique({
      where: { id }
    })

    return template ? this.transformTemplate(template) : null
  },

  /**
   * 获取所有分类
   */
  async getTemplateCategories(): Promise<Array<{ value: string; label: string; count: number }>> {
    const result = await prisma.dockerfileTemplate.groupBy({
      by: ['category'],
      where: { is_active: true },
      _count: { category: true },
      orderBy: { category: 'asc' }
    })

    return result.map(item => ({
      value: item.category,
      label: item.category,
      count: item._count.category
    }))
  },

  /**
   * 创建新模板
   */
  async createTemplate(data: CreateDockerfileTemplateRequest): Promise<DockerfileTemplateData> {
    const template = await prisma.dockerfileTemplate.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        category: data.category,
        base_image: data.base_image,
        workdir: data.workdir || '/app',
        copy_files: data.copy_files || [],
        install_commands: data.install_commands || [],
        build_commands: data.build_commands || [],
        run_command: data.run_command,
        expose_ports: data.expose_ports || [],
        env_vars: data.env_vars || {},
        dockerfile_content: data.dockerfile_content,
        is_system: false,
        created_by: data.created_by
      }
    })

    return this.transformTemplate(template)
  },

  /**
   * 更新模板
   */
  async updateTemplate(id: string, data: UpdateDockerfileTemplateRequest): Promise<DockerfileTemplateData> {
    const template = await prisma.dockerfileTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        base_image: data.base_image,
        workdir: data.workdir,
        copy_files: data.copy_files,
        install_commands: data.install_commands,
        build_commands: data.build_commands,
        run_command: data.run_command,
        expose_ports: data.expose_ports,
        env_vars: data.env_vars,
        dockerfile_content: data.dockerfile_content,
        is_active: data.is_active,
        updated_by: data.updated_by
      }
    })

    return this.transformTemplate(template)
  },

  /**
   * 删除模板（软删除）
   */
  async deleteTemplate(id: string, updatedBy?: string): Promise<void> {
    await prisma.dockerfileTemplate.update({
      where: { id },
      data: {
        is_active: false,
        updated_by: updatedBy
      }
    })
  },

  /**
   * 初始化系统模板
   */
  async initializeSystemTemplates(): Promise<void> {
    const systemTemplates: CreateDockerfileTemplateRequest[] = [
      {
        id: 'pnpm-frontend',
        name: 'PNPM前端构建',
        description: '基于公司私库PNPM镜像构建前端项目，使用Nginx提供静态文件服务',
        category: '前端',
        base_image: 'nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine (linux/amd64)',
        workdir: '/app',
        copy_files: ['package.json', 'pnpm-lock.yaml', '.'],
        install_commands: ['pnpm install --frozen-lockfile'],
        build_commands: ['pnpm run build'],
        run_command: 'nginx -g "daemon off;"',
        expose_ports: [80],
        env_vars: { NODE_ENV: 'production' },
        dockerfile_content: `# PNPM前端构建模板 - 多阶段构建
# 第一阶段：使用公司私库PNPM镜像构建前端项目
# 第二阶段：使用Nginx提供静态文件服务

# 构建阶段
FROM --platform=linux/amd64 nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine AS builder

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production

# 复制package.json和pnpm-lock.yaml
COPY package.json ./
COPY pnpm-lock.yaml* ./

# 安装依赖（兼容不同版本的lockfile）
RUN if [ -f pnpm-lock.yaml ]; then \\
      pnpm install --frozen-lockfile || pnpm install --force; \\
    else \\
      pnpm install; \\
    fi

# 复制应用代码
COPY . ./

# 构建应用
RUN pnpm run build

# 生产阶段
FROM nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5

# 删除默认的nginx配置和静态文件
RUN rm -rf /usr/share/nginx/html/* && \\
    rm -f /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
# 默认从dist目录复制（最常见的构建输出目录）
# 如果项目使用其他目录（如build、out），需要在自定义Dockerfile中修改此行
COPY --from=builder /app/dist /usr/share/nginx/html

# 验证构建产物并创建默认页面（如果需要）
RUN echo "Checking build output..." && \\
    ls -la /usr/share/nginx/html/ && \\
    if [ ! -f /usr/share/nginx/html/index.html ]; then \\
      echo "Warning: index.html not found, creating default page"; \\
      echo '<!DOCTYPE html><html><head><title>App</title></head><body><h1>Application Loading...</h1><script>console.log("No index.html found")</script></body></html>' > /usr/share/nginx/html/index.html; \\
    fi

# 创建优化的nginx配置文件
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \\
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    index index.html index.htm;' >> /etc/nginx/conf.d/default.conf && \\
    echo '' >> /etc/nginx/conf.d/default.conf && \\
    echo '    # 错误页面配置' >> /etc/nginx/conf.d/default.conf && \\
    echo '    error_page 404 /index.html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '' >> /etc/nginx/conf.d/default.conf && \\
    echo '    # 主要位置块 - SPA路由支持' >> /etc/nginx/conf.d/default.conf && \\
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \\
    echo '        try_files \\$uri \\$uri/ @fallback;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    }' >> /etc/nginx/conf.d/default.conf && \\
    echo '' >> /etc/nginx/conf.d/default.conf && \\
    echo '    # 回退处理' >> /etc/nginx/conf.d/default.conf && \\
    echo '    location @fallback {' >> /etc/nginx/conf.d/default.conf && \\
    echo '        rewrite ^.*\\$ /index.html last;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    }' >> /etc/nginx/conf.d/default.conf && \\
    echo '' >> /etc/nginx/conf.d/default.conf && \\
    echo '    # 静态资源缓存' >> /etc/nginx/conf.d/default.conf && \\
    echo '    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\$ {' >> /etc/nginx/conf.d/default.conf && \\
    echo '        expires 1y;' >> /etc/nginx/conf.d/default.conf && \\
    echo '        add_header Cache-Control "public, immutable";' >> /etc/nginx/conf.d/default.conf && \\
    echo '        try_files \\$uri =404;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    }' >> /etc/nginx/conf.d/default.conf && \\
    echo '' >> /etc/nginx/conf.d/default.conf && \\
    echo '    # API代理（如果需要）' >> /etc/nginx/conf.d/default.conf && \\
    echo '    location /api/ {' >> /etc/nginx/conf.d/default.conf && \\
    echo '        try_files \\$uri @fallback;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    }' >> /etc/nginx/conf.d/default.conf && \\
    echo '' >> /etc/nginx/conf.d/default.conf && \\
    echo '    # 安全头' >> /etc/nginx/conf.d/default.conf && \\
    echo '    add_header X-Frame-Options "SAMEORIGIN" always;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    add_header X-Content-Type-Options "nosniff" always;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    add_header X-XSS-Protection "1; mode=block" always;' >> /etc/nginx/conf.d/default.conf && \\
    echo '}' >> /etc/nginx/conf.d/default.conf

# 设置权限
RUN chmod -R 755 /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]`
      }
      // 可以添加更多系统模板...
    ]

    for (const template of systemTemplates) {
      await prisma.dockerfileTemplate.upsert({
        where: { id: template.id },
        update: {
          dockerfile_content: template.dockerfile_content,
          updated_at: new Date()
        },
        create: {
          ...template,
          is_system: true
        }
      })
    }
  },

  /**
   * 转换数据库模型为前端使用的格式
   */
  transformTemplate(template: DockerfileTemplate): DockerfileTemplateData {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      baseImage: template.base_image,
      workdir: template.workdir,
      copyFiles: Array.isArray(template.copy_files) ? template.copy_files as string[] : [],
      installCommands: Array.isArray(template.install_commands) ? template.install_commands as string[] : [],
      buildCommands: Array.isArray(template.build_commands) ? template.build_commands as string[] : [],
      runCommand: template.run_command,
      exposePorts: Array.isArray(template.expose_ports) ? template.expose_ports as number[] : [],
      envVars: (template.env_vars as Record<string, string>) || {},
      dockerfile: template.dockerfile_content
    }
  }
}