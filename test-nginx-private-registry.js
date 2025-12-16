#!/usr/bin/env node

/**
 * 测试 Nginx 私库镜像更新
 * 验证所有模板中的 Nginx 镜像都更新为公司私库镜像
 */

const fs = require('fs')

console.log('🔧 测试 Nginx 私库镜像更新...\n')

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
    name: 'PNPM模板使用私库Nginx镜像',
    test: () => {
      const pnpmMatch = templateContent.match(/id: 'pnpm-frontend'[\s\S]*?dockerfile: `([\s\S]*?)`/);
      if (!pnpmMatch) return false;
      const pnpmDockerfile = pnpmMatch[1];
      return pnpmDockerfile.includes('FROM nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5');
    },
    expected: true
  },
  {
    name: 'nginx-static模板使用私库Nginx镜像 (baseImage)',
    test: () => templateContent.includes("baseImage: 'nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5'"),
    expected: true
  },
  {
    name: 'nginx-static模板使用私库Nginx镜像 (Dockerfile)',
    test: () => {
      const nginxMatch = templateContent.match(/id: 'nginx-static'[\s\S]*?dockerfile: `([\s\S]*?)`/);
      if (!nginxMatch) return false;
      const nginxDockerfile = nginxMatch[1];
      return nginxDockerfile.includes('FROM nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5');
    },
    expected: true
  },
  {
    name: '不再使用阿里云镜像仓库的Nginx',
    test: () => !templateContent.includes('registry.cn-hangzhou.aliyuncs.com/library/nginx'),
    expected: true
  },
  {
    name: '使用指定版本 1.27.5',
    test: () => templateContent.includes('nginx:1.27.5'),
    expected: true
  },
  {
    name: '保持PNPM镜像配置不变',
    test: () => templateContent.includes('nexus.aimstek.cn/xuanwu-factory/common/pnpm:node20-alpine'),
    expected: true
  },
  {
    name: '保持端口配置不变',
    test: () => templateContent.includes('exposePorts: [80]'),
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
  console.log('\n🎉 Nginx 私库镜像更新成功!')
  console.log('\n更新内容:')
  console.log('- 🏢 PNPM模板: registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine → nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5')
  console.log('- 🏢 nginx-static模板: registry.cn-hangzhou.aliyuncs.com/library/nginx:alpine → nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5')
  console.log('- 📦 版本指定: 使用明确的版本号 1.27.5')
  console.log('- 🔧 统一管理: 所有Nginx镜像使用同一私库源')
  
  console.log('\n✨ 现在所有模板都使用公司私库的Nginx镜像!')
  
  console.log('\n🔧 私库Nginx镜像优势:')
  console.log('- 🚀 更快的拉取速度（内网访问）')
  console.log('- 🔒 更好的安全控制和版本管理')
  console.log('- 📦 统一的镜像来源和维护')
  console.log('- 🛡️  避免外网依赖和供应链风险')
  console.log('- 📋 明确的版本控制 (1.27.5)')
  
  console.log('\n📋 更新的模板:')
  console.log('- pnpm-frontend: PNPM前端构建模板')
  console.log('- nginx-static: Nginx静态文件服务模板')
  
  console.log('\n🔍 镜像信息:')
  console.log('- 私库地址: nexus.aimstek.cn')
  console.log('- 项目路径: xuanwu-factory/common')
  console.log('- 镜像名称: nginx:1.27.5')
  console.log('- 完整路径: nexus.aimstek.cn/xuanwu-factory/common/nginx:1.27.5')
} else {
  console.log('\n❌ 更新验证失败，请检查代码')
  process.exit(1)
}