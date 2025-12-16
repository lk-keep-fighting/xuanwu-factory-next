#!/usr/bin/env node

/**
 * 测试 PNPM 平台架构修复
 * 验证 PNPM 模板指定正确的平台架构以避免 exec format error
 */

const fs = require('fs')

console.log('🔧 测试 PNPM 平台架构修复...\n')

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
    name: '使用 --platform=linux/amd64 指定平台',
    test: () => templateContent.includes('FROM --platform=linux/amd64 nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine AS builder'),
    expected: true
  },
  {
    name: 'baseImage 字段包含平台信息',
    test: () => templateContent.includes('baseImage: \'nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine (linux/amd64)\''),
    expected: true
  },
  {
    name: '保持 Nginx 镜像不变（通常支持多架构）',
    test: () => templateContent.includes('FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine') && !templateContent.includes('FROM --platform=linux/amd64 registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine'),
    expected: true
  },
  {
    name: '保持其他配置不变 - 端口 80',
    test: () => templateContent.includes('exposePorts: [80]'),
    expected: true
  },
  {
    name: '保持其他配置不变 - Nginx 启动命令',
    test: () => templateContent.includes('runCommand: \'nginx -g "daemon off;"\''),
    expected: true
  },
  {
    name: '保持多阶段构建结构',
    test: () => templateContent.includes('AS builder') && templateContent.includes('COPY --from=builder'),
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
  console.log('\n🎉 PNPM 平台架构修复成功!')
  console.log('\n修复内容:')
  console.log('- 🏗️  添加 --platform=linux/amd64 到 FROM 指令')
  console.log('- 📝 更新 baseImage 字段包含平台信息')
  console.log('- 🔧 强制使用 AMD64 架构避免 ARM64 兼容性问题')
  console.log('- ✅ 保持其他配置不变')
  
  console.log('\n✨ 现在 PNPM 构建将使用正确的平台架构!')
  
  console.log('\n🔍 问题分析:')
  console.log('- 错误原因: 镜像平台不匹配 (linux/arm64 vs linux/amd64)')
  console.log('- 错误现象: exec format error')
  console.log('- 解决方案: 明确指定 --platform=linux/amd64')
  
  console.log('\n🛠️  平台架构说明:')
  console.log('- linux/amd64: x86_64 架构 (Intel/AMD 处理器)')
  console.log('- linux/arm64: ARM64 架构 (Apple M1/M2, ARM 服务器)')
  console.log('- 构建环境: 通常为 linux/amd64')
  console.log('- 解决方案: 强制使用 amd64 版本镜像')
} else {
  console.log('\n❌ 修复验证失败，请检查代码')
  process.exit(1)
}