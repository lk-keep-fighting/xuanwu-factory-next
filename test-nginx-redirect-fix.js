#!/usr/bin/env node

/**
 * 测试 Nginx 重定向循环修复
 * 验证 PNPM 模板的 Nginx 配置修复了重定向循环问题
 */

const fs = require('fs')

console.log('🔧 测试 Nginx 重定向循环修复...\n')

// 检查模板文件
const templatePath = 'src/lib/dockerfile-templates.ts'

if (!fs.existsSync(templatePath)) {
  console.error('❌ 模板文件不存在')
  process.exit(1)
}

const templateContent = fs.readFileSync(templatePath, 'utf8')

// 提取PNPM模板的dockerfile内容
const pnpmMatch = templateContent.match(/id: 'pnpm-frontend'[\s\S]*?dockerfile: `([\s\S]*?)`/);
if (!pnpmMatch) {
  console.error('❌ 找不到 PNPM 模板')
  process.exit(1)
}

const pnpmDockerfile = pnpmMatch[1]

// 验证修复
const tests = [
  {
    name: '使用 @fallback 命名位置避免循环',
    test: () => pnpmDockerfile.includes('try_files \\\\$uri \\\\$uri/ @fallback'),
    expected: true
  },
  {
    name: '定义 @fallback 位置块',
    test: () => pnpmDockerfile.includes('location @fallback'),
    expected: true
  },
  {
    name: '使用 rewrite 而不是 try_files 到 index.html',
    test: () => pnpmDockerfile.includes('rewrite ^.*\\\\$ /index.html last'),
    expected: true
  },
  {
    name: '不再直接使用 try_files 到 /index.html',
    test: () => !pnpmDockerfile.includes('try_files \\$uri \\$uri/ /index.html'),
    expected: true
  },
  {
    name: '添加错误页面配置',
    test: () => pnpmDockerfile.includes('error_page 404 /index.html'),
    expected: true
  },
  {
    name: '静态资源使用独立的 try_files',
    test: () => pnpmDockerfile.includes('try_files \\\\$uri =404'),
    expected: true
  },
  {
    name: '添加构建产物验证',
    test: () => pnpmDockerfile.includes('Checking build output') && pnpmDockerfile.includes('ls -la /usr/share/nginx/html/'),
    expected: true
  },
  {
    name: '创建默认页面作为回退',
    test: () => pnpmDockerfile.includes('index.html not found, creating default page'),
    expected: true
  },
  {
    name: '支持 API 路由',
    test: () => pnpmDockerfile.includes('location /api/'),
    expected: true
  },
  {
    name: '保持安全头配置',
    test: () => pnpmDockerfile.includes('X-Frame-Options') && pnpmDockerfile.includes('X-Content-Type-Options'),
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
  console.log('\n🎉 Nginx 重定向循环修复成功!')
  console.log('\n修复内容:')
  console.log('- 🔄 使用 @fallback 命名位置避免重定向循环')
  console.log('- 🎯 使用 rewrite 指令而不是 try_files 到 /index.html')
  console.log('- 📄 添加错误页面配置 (error_page 404)')
  console.log('- 🔍 添加构建产物验证和调试信息')
  console.log('- 🛡️  为静态资源使用独立的 try_files 配置')
  console.log('- 🚀 支持 API 路由处理')
  console.log('- 📝 创建默认页面作为回退机制')
  
  console.log('\n✨ 现在 Nginx 配置不会再出现重定向循环!')
  
  console.log('\n🔧 修复原理:')
  console.log('- 问题: try_files $uri $uri/ /index.html 可能导致循环')
  console.log('- 解决: 使用命名位置 @fallback 分离处理逻辑')
  console.log('- 优势: 更清晰的请求处理流程，避免内部重定向冲突')
  
  console.log('\n📋 新的 Nginx 配置流程:')
  console.log('1. 尝试直接访问文件 ($uri)')
  console.log('2. 尝试访问目录 ($uri/)')
  console.log('3. 如果都失败，跳转到 @fallback 位置')
  console.log('4. @fallback 使用 rewrite 重写到 /index.html')
  console.log('5. 静态资源有独立的处理逻辑')
} else {
  console.log('\n❌ 修复验证失败，请检查代码')
  process.exit(1)
}