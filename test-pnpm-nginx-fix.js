#!/usr/bin/env node

/**
 * 测试 PNPM 前端构建 Nginx 修复
 * 验证 PNPM 模板使用多阶段构建和 Nginx 提供静态文件服务
 */

const fs = require('fs')

console.log('🔧 测试 PNPM 前端构建 Nginx 修复...\n')

// 检查模板文件
const templatePath = 'src/lib/dockerfile-templates.ts'

if (!fs.existsSync(templatePath)) {
  console.error('❌ 模板文件不存在')
  process.exit(1)
}

const templateContent = fs.readFileSync(templatePath, 'utf8')

// 验证修复
const tests = [
  {
    name: '使用多阶段构建',
    test: () => templateContent.includes('FROM gplane/pnpm:node20-alpine AS builder'),
    expected: true
  },
  {
    name: '第二阶段使用 Nginx',
    test: () => templateContent.includes('FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine'),
    expected: true
  },
  {
    name: '不再使用复杂的启动脚本',
    test: () => !templateContent.includes('/app/start.sh'),
    expected: true
  },
  {
    name: '不再使用 serve 包',
    test: () => !templateContent.includes('pnpm add -g serve'),
    expected: true
  },
  {
    name: '使用 COPY --from=builder',
    test: () => templateContent.includes('COPY --from=builder /app/dist'),
    expected: true
  },
  {
    name: '暴露端口 80 (Nginx)',
    test: () => templateContent.includes('EXPOSE 80'),
    expected: true
  },
  {
    name: 'PNPM模板不再暴露端口 3000',
    test: () => {
      // 提取PNPM模板的dockerfile内容
      const pnpmMatch = templateContent.match(/id: 'pnpm-frontend'[\s\S]*?dockerfile: `([\s\S]*?)`/);
      if (!pnpmMatch) return false;
      const pnpmDockerfile = pnpmMatch[1];
      return !pnpmDockerfile.includes('EXPOSE 3000');
    },
    expected: true
  },
  {
    name: '使用 Nginx 启动命令',
    test: () => templateContent.includes('CMD ["nginx", "-g", "daemon off;"]'),
    expected: true
  },
  {
    name: '配置 SPA 路由支持',
    test: () => templateContent.includes('try_files \\\\$uri \\\\$uri/ /index.html'),
    expected: true
  },
  {
    name: '配置静态资源缓存',
    test: () => templateContent.includes('expires 1y'),
    expected: true
  },
  {
    name: '添加安全头',
    test: () => templateContent.includes('X-Frame-Options') && templateContent.includes('X-Content-Type-Options'),
    expected: true
  },
  {
    name: '删除默认 Nginx 配置',
    test: () => templateContent.includes('rm -rf /usr/share/nginx/html/*'),
    expected: true
  },
  {
    name: '更新模板描述',
    test: () => templateContent.includes('使用Nginx提供静态文件服务'),
    expected: true
  },
  {
    name: '更新 runCommand',
    test: () => templateContent.includes('runCommand: \'nginx -g "daemon off;"\''),
    expected: true
  },
  {
    name: '更新 exposePorts',
    test: () => templateContent.includes('exposePorts: [80]'),
    expected: true
  }
]

let passed = 0
let failed = 0

tests.forEach(({ name, test, expected }) => {
  const result = test()
  if (result === expected) {
    console.log(`✅ ${name}`)
    passed++
  } else {
    console.log(`❌ ${name}`)
    console.log(`   期望: ${expected}, 实际: ${result}`)
    failed++
  }
})

console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`)

if (failed === 0) {
  console.log('\n🎉 PNPM 前端构建 Nginx 修复成功!')
  console.log('\n修复内容:')
  console.log('- 🏗️  使用多阶段构建：构建阶段 + 生产阶段')
  console.log('- 📦 构建阶段：使用 PNPM 构建前端项目')
  console.log('- 🌐 生产阶段：使用 Nginx 提供静态文件服务')
  console.log('- 🚀 支持 SPA 路由 (try_files)')
  console.log('- ⚡ 静态资源缓存优化')
  console.log('- 🔒 添加安全头配置')
  console.log('- 🎯 暴露端口 80 (标准 HTTP 端口)')
  
  console.log('\n✨ 现在 PNPM 前端构建使用正确的生产部署方式!')
  
  console.log('\n🔧 构建流程:')
  console.log('1. 第一阶段：使用 gplane/pnpm:node20-alpine 构建前端项目')
  console.log('2. 安装依赖：pnpm install --frozen-lockfile')
  console.log('3. 构建项目：pnpm run build')
  console.log('4. 第二阶段：使用 Nginx Alpine 镜像')
  console.log('5. 复制构建产物：从 /app/dist 到 /usr/share/nginx/html')
  console.log('6. 配置 Nginx：SPA 路由、缓存、安全头')
  console.log('7. 启动 Nginx 服务')
  
  console.log('\n📁 支持的构建输出目录:')
  console.log('- dist/ (默认，Vite、Vue CLI 等)')
  console.log('- 如需其他目录 (build/, out/)，可在自定义 Dockerfile 中修改')
} else {
  console.log('\n❌ 修复验证失败，请检查代码')
  process.exit(1)
}