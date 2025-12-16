#!/usr/bin/env node

/**
 * 测试 PNPM 模板修复
 * 验证 PNPM 前端构建模板的启动脚本修复
 */

const fs = require('fs')

console.log('🔧 测试 PNPM 模板修复...\n')

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
    name: '包含 PNPM 前端模板',
    test: () => templateContent.includes("id: 'pnpm-frontend'"),
    expected: true
  },
  {
    name: '不再直接使用 pnpm start',
    test: () => !templateContent.includes('CMD ["pnpm", "start"]'),
    expected: true
  },
  {
    name: '包含启动脚本创建逻辑',
    test: () => templateContent.includes('echo \'#!/bin/sh\' > /app/start.sh'),
    expected: true
  },
  {
    name: '检查 start 脚本存在性',
    test: () => templateContent.includes('pnpm run --silent start --help'),
    expected: true
  },
  {
    name: '支持 serve 脚本回退',
    test: () => templateContent.includes('pnpm run --silent serve --help'),
    expected: true
  },
  {
    name: '支持 preview 脚本回退',
    test: () => templateContent.includes('pnpm run --silent preview --help'),
    expected: true
  },
  {
    name: '支持静态文件服务回退 (dist)',
    test: () => templateContent.includes('dist/index.html'),
    expected: true
  },
  {
    name: '支持静态文件服务回退 (build)',
    test: () => templateContent.includes('build/index.html'),
    expected: true
  },
  {
    name: '安装 serve 包',
    test: () => templateContent.includes('pnpm add -g serve'),
    expected: true
  },
  {
    name: '使用启动脚本作为 CMD',
    test: () => templateContent.includes('CMD ["/app/start.sh"]'),
    expected: true
  },
  {
    name: '包含错误处理和提示',
    test: () => templateContent.includes('No suitable start method found'),
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
  console.log('\n🎉 PNPM 模板修复成功!')
  console.log('\n修复内容:')
  console.log('- 创建智能启动脚本，支持多种启动方式')
  console.log('- 优先检查 pnpm start 脚本')
  console.log('- 回退到 pnpm run serve 或 pnpm run preview')
  console.log('- 最后回退到静态文件服务 (serve)')
  console.log('- 支持 dist/ 和 build/ 输出目录')
  console.log('- 提供详细的错误提示')
  
  console.log('\n✨ 现在 PNPM 模板可以处理各种前端项目类型了!')
  console.log('\n支持的启动方式:')
  console.log('1. pnpm start (如果存在)')
  console.log('2. pnpm run serve (如果存在)')
  console.log('3. pnpm run preview (如果存在)')
  console.log('4. serve -s dist (如果 dist/index.html 存在)')
  console.log('5. serve -s build (如果 build/index.html 存在)')
} else {
  console.log('\n❌ 修复验证失败，请检查代码')
  process.exit(1)
}