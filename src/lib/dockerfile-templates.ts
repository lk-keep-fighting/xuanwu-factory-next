import type { DockerfileTemplate } from '@/types/project'

/**
 * 公司Dockerfile模板定义
 * 基于公司具体需求和基础镜像创建的模板
 */
export const COMPANY_DOCKERFILE_TEMPLATES: DockerfileTemplate[] = [
  {
    id: 'pnpm-frontend',
    name: 'PNPM前端构建',
    description: '基于gplane/pnpm:node20-alpine的前端项目构建',
    category: '前端',
    baseImage: 'gplane/pnpm:node20-alpine',
    workdir: '/app',
    copyFiles: ['package.json', 'pnpm-lock.yaml', '.'],
    installCommands: ['pnpm install --frozen-lockfile'],
    buildCommands: ['pnpm run build'],
    runCommand: 'pnpm start',
    exposePorts: [3000],
    envVars: {
      NODE_ENV: 'production',
      PORT: '3000'
    },
    dockerfile: `# PNPM前端构建模板
# 基于gplane/pnpm:node20-alpine的前端项目构建

FROM gplane/pnpm:node20-alpine

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 复制package.json
COPY package.json ./

# 复制pnpm-lock.yaml（如果存在）
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

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]`
  },
  
  {
    id: 'maven-java21',
    name: 'Maven Java21构建',
    description: '基于nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21的Maven项目构建',
    category: 'Java',
    baseImage: 'nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21',
    workdir: '/app',
    copyFiles: ['pom.xml', '.'],
    installCommands: ['mvn dependency:go-offline'],
    buildCommands: ['mvn clean package -DskipTests'],
    runCommand: 'java -jar target/*.jar',
    exposePorts: [8080],
    envVars: {
      JAVA_OPTS: '-Xms512m -Xmx1024m',
      MAVEN_OPTS: '-Dmaven.repo.local=/root/.m2/repository'
    },
    dockerfile: `# Maven Java21构建模板
# 基于nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21的Maven项目构建

FROM nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21

WORKDIR /app

# 设置环境变量
ENV JAVA_OPTS="-Xms512m -Xmx1024m"
ENV MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository"

# 复制Maven配置文件
COPY pom.xml ./

# 下载依赖
RUN mvn dependency:go-offline

# 复制应用代码
COPY . ./

# 构建应用
RUN mvn clean package -DskipTests

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["java", "-jar", "target/*.jar"]`
  },

  {
    id: 'nginx-static',
    name: 'Nginx静态文件',
    description: '基于Nginx的静态文件服务',
    category: '前端',
    baseImage: 'registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine',
    workdir: '/usr/share/nginx/html',
    copyFiles: ['dist/', '.'],
    installCommands: [],
    buildCommands: [],
    runCommand: 'nginx -g "daemon off;"',
    exposePorts: [80],
    envVars: {},
    dockerfile: `# Nginx静态文件模板
# 基于Nginx的静态文件服务

FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine

# 删除默认配置
RUN rm -rf /usr/share/nginx/html/*
RUN rm -f /etc/nginx/conf.d/default.conf

# 复制静态文件
COPY dist/ /usr/share/nginx/html/

# 创建nginx配置
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \\
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \\
    echo '        try_files \\$uri \\$uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    }' >> /etc/nginx/conf.d/default.conf && \\
    echo '}' >> /etc/nginx/conf.d/default.conf

# 设置权限
RUN chmod -R 755 /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动Nginx
CMD ["nginx", "-g", "daemon off;"]`
  },

  {
    id: 'node18-standard',
    name: 'Node.js 18标准应用',
    description: '基于Node.js 18的标准Web应用',
    category: 'Node.js',
    baseImage: 'registry.cn-hangzhou.aliyuncs.com/library/node:18-alpine',
    workdir: '/app',
    copyFiles: ['package*.json', '.'],
    installCommands: ['npm ci --only=production'],
    buildCommands: [],
    runCommand: 'npm start',
    exposePorts: [3000],
    envVars: {
      NODE_ENV: 'production',
      PORT: '3000'
    },
    dockerfile: `# Node.js 18标准应用模板
# 基于Node.js 18的标准Web应用

FROM registry.cn-hangzhou.aliyuncs.com/library/node:18-alpine

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . ./

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]`
  },

  {
    id: 'python-flask',
    name: 'Python Flask应用',
    description: '基于Python的Flask Web应用',
    category: 'Python',
    baseImage: 'registry.cn-hangzhou.aliyuncs.com/library/python:3.11-slim',
    workdir: '/app',
    copyFiles: ['requirements.txt', '.'],
    installCommands: ['pip install --no-cache-dir -r requirements.txt'],
    buildCommands: [],
    runCommand: 'python app.py',
    exposePorts: [8000],
    envVars: {
      PYTHONPATH: '/app',
      PYTHONUNBUFFERED: '1'
    },
    dockerfile: `# Python Flask应用模板
# 基于Python的Flask Web应用

FROM registry.cn-hangzhou.aliyuncs.com/library/python:3.11-slim

WORKDIR /app

# 设置环境变量
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 复制依赖文件
COPY requirements.txt ./

# 安装依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . ./

# 暴露端口
EXPOSE 8000

# 启动应用
CMD ["python", "app.py"]`
  },

  {
    id: 'custom-blank',
    name: '自定义空白模板',
    description: '空白模板，完全自定义配置',
    category: '自定义',
    baseImage: 'registry.cn-hangzhou.aliyuncs.com/library/ubuntu:22.04',
    workdir: '/app',
    copyFiles: ['.'],
    installCommands: [],
    buildCommands: [],
    runCommand: 'echo "请配置启动命令"',
    exposePorts: [8080],
    envVars: {},
    dockerfile: `# 自定义空白模板
# 完全自定义配置

FROM registry.cn-hangzhou.aliyuncs.com/library/ubuntu:22.04

WORKDIR /app

# 复制应用代码
COPY . ./

# 暴露端口
EXPOSE 8080

# 启动命令（请根据实际情况修改）
CMD ["echo", "请配置启动命令"]`
  }
]

/**
 * 获取所有可用的模板
 */
export function getAllTemplates(): DockerfileTemplate[] {
  return COMPANY_DOCKERFILE_TEMPLATES
}

/**
 * 根据分类获取模板
 */
export function getTemplatesByCategory(category: string): DockerfileTemplate[] {
  return COMPANY_DOCKERFILE_TEMPLATES.filter(template => template.category === category)
}

/**
 * 根据ID获取模板
 */
export function getTemplateById(id: string): DockerfileTemplate | undefined {
  return COMPANY_DOCKERFILE_TEMPLATES.find(template => template.id === id)
}

/**
 * 获取所有分类
 */
export function getTemplateCategories(): Array<{ value: string; label: string; count: number }> {
  const categories = new Map<string, number>()
  
  COMPANY_DOCKERFILE_TEMPLATES.forEach(template => {
    categories.set(template.category, (categories.get(template.category) || 0) + 1)
  })
  
  return Array.from(categories.entries()).map(([category, count]) => ({
    value: category,
    label: category,
    count
  }))
}