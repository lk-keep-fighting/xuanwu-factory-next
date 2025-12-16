#!/usr/bin/env node

/**
 * 测试 PNPM 私库镜像更新
 * 验证 PNPM 模板使用公司私库镜像
 */

const fs = require('fs')

console.log('🔧 测试 PNPM 私库镜像更新...\n')

// 检查模板文件
const templatePath = 'src/lib/dockerfile-templates.ts'

if (!fs.existsSync(templatePath)) {
  console.error('❌ 模板文件不存在')
  process.exit(1)
}

const templateContent = fs.readFileSync(templatePath, 'utf8')

// 验证更新
const tests = [
  {
    name: '使用私库镜像作为 baseImage',
    test: () => templateContent.includes("baseImage: 'nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine'"),
    expected: true
  },
  {
    name: '不再使用公共镜像 gplane/pnpm',
    test: () => {
      // 检查PNPM模板部分是否还包含gplane/pnpm
      const pnpmMatch = templateContent.match(/id: 'pnpm-frontend'[\s\S]*?dockerfile: `([\s\S]*?)`/);
      if (!pnpmMatch) return false;
      const pnpmDockerfile = pnpmMatch[1];
      return !pnpmDockerfile.includes('gplane/pnpm');
    },
    expected: true
  },
  {
    name: 'Dockerfile 中使用私库镜像',
    test: () => templateContent.includes('FROM nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine AS builder'),
    expected: true
  },
  {
    name: '更新模板描述',
    test: () => templateContent.includes('基于公司私库PNPM镜像构建前端项目'),
    expected: true
  },
  {
    name: '更新 Dockerfile 注释',
    test: () => templateContent.includes('使用公司私库PNPM镜像构建前端项目'),
    expected: true
  },
  {
    name: '保持其他配置不变 - Nginx 镜像',
    test: () => templateContent.includes('FROM registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine'),
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
  console.log('\n🎉 PNPM 私库镜像更新成功!')
  console.log('\n更新内容:')
  console.log('- 🏢 baseImage: gplane/pnpm:node20-alpine → nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine')
  console.log('- 🐳 Dockerfile FROM: 更新为私库镜像')
  console.log('- 📝 描述: 更新为"基于公司私库PNPM镜像构建"')
  console.log('- 💬 注释: 更新Dockerfile注释说明')
  
  console.log('\n✨ 现在 PNPM 模板使用公司私库镜像!')
  
  console.log('\n🔧 私库镜像优势:')
  console.log('- 🚀 更快的拉取速度（内网访问）')
  console.log('- 🔒 更好的安全控制')
  console.log('- 📦 统一的镜像管理')
  console.log('- 🛡️  避免外网依赖风险')
  
  console.log('\n📋 镜像信息:')
  console.log('- 私库地址: nexus.aimstek.cn')
  console.log('- 项目路径: xuanwu-factory/common')
  console.log('- 镜像名称: pnpm:node20-alpine')
  console.log('- 完整路径: nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine')
} else {
  console.log('\n❌ 更新验证失败，请检查代码')
  process.exit(1)
}