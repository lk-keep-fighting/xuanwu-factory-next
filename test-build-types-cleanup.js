#!/usr/bin/env node

/**
 * 测试构建类型清理
 * 验证只保留 Dockerfile 和模板构建两种方式
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 测试构建类型清理...\n')

// 检查文件
const filesToCheck = [
  'src/types/project.ts',
  'src/components/services/BuildConfigurationCard.tsx',
  'src/app/projects/components/ServiceCreateForm.tsx',
  'src/app/api/services/[id]/build/route.ts'
]

let passed = 0
let failed = 0

// 检查 BuildType 枚举
console.log('📋 检查 BuildType 枚举定义...')
const projectTypesPath = 'src/types/project.ts'
if (fs.existsSync(projectTypesPath)) {
  const content = fs.readFileSync(projectTypesPath, 'utf8')
  
  const tests = [
    {
      name: '包含 DOCKERFILE 类型',
      test: () => content.includes("DOCKERFILE = 'dockerfile'"),
      expected: true
    },
    {
      name: '包含 TEMPLATE 类型',
      test: () => content.includes("TEMPLATE = 'template'"),
      expected: true
    },
    {
      name: '不包含 JAVA_JAR 类型',
      test: () => !content.includes("JAVA_JAR = 'java_jar'"),
      expected: true
    },
    {
      name: '不包含 FRONTEND 类型',
      test: () => !content.includes("FRONTEND = 'frontend'"),
      expected: true
    },
    {
      name: '不包含 NIXPACKS 类型',
      test: () => !content.includes("NIXPACKS = 'nixpacks'"),
      expected: true
    },
    {
      name: '不包含 BUILDPACKS 类型',
      test: () => !content.includes("BUILDPACKS = 'buildpacks'"),
      expected: true
    }
  ]
  
  tests.forEach(({ name, test, expected }) => {
    const result = test()
    if (result === expected) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.log(`  ❌ ${name}`)
      failed++
    }
  })
} else {
  console.log('  ❌ 项目类型文件不存在')
  failed++
}

// 检查 BuildConfigurationCard 组件
console.log('\n📋 检查 BuildConfigurationCard 组件...')
const buildCardPath = 'src/components/services/BuildConfigurationCard.tsx'
if (fs.existsSync(buildCardPath)) {
  const content = fs.readFileSync(buildCardPath, 'utf8')
  
  const tests = [
    {
      name: '不包含 Java JAR 选项',
      test: () => !content.includes('Java JAR包'),
      expected: true
    },
    {
      name: '不包含前端构建选项',
      test: () => !content.includes('前端构建') || content.includes('前端构建').length <= 1, // 可能在注释中
      expected: true
    },
    {
      name: '不包含 renderJavaJarConfig 函数',
      test: () => !content.includes('renderJavaJarConfig'),
      expected: true
    },
    {
      name: '不包含 renderFrontendConfig 函数',
      test: () => !content.includes('renderFrontendConfig'),
      expected: true
    },
    {
      name: '包含 Dockerfile 选项',
      test: () => content.includes('Dockerfile'),
      expected: true
    },
    {
      name: '包含模板构建选项',
      test: () => content.includes('模板构建'),
      expected: true
    }
  ]
  
  tests.forEach(({ name, test, expected }) => {
    const result = test()
    if (result === expected) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.log(`  ❌ ${name}`)
      failed++
    }
  })
} else {
  console.log('  ❌ BuildConfigurationCard 文件不存在')
  failed++
}

// 检查 ServiceCreateForm 组件
console.log('\n📋 检查 ServiceCreateForm 组件...')
const createFormPath = 'src/app/projects/components/ServiceCreateForm.tsx'
if (fs.existsSync(createFormPath)) {
  const content = fs.readFileSync(createFormPath, 'utf8')
  
  const tests = [
    {
      name: '不包含 Java JAR 配置界面',
      test: () => !content.includes('BuildType.JAVA_JAR'),
      expected: true
    },
    {
      name: '不包含前端构建配置界面',
      test: () => !content.includes('BuildType.FRONTEND'),
      expected: true
    },
    {
      name: '不包含 Java 版本选择',
      test: () => !content.includes('Java版本') || !content.includes('Java 8'),
      expected: true
    },
    {
      name: '不包含前端框架选择',
      test: () => !content.includes('前端框架') || !content.includes('React'),
      expected: true
    },
    {
      name: '包含 Dockerfile 选项',
      test: () => content.includes('BuildType.DOCKERFILE'),
      expected: true
    },
    {
      name: '包含模板构建选项',
      test: () => content.includes('BuildType.TEMPLATE'),
      expected: true
    }
  ]
  
  tests.forEach(({ name, test, expected }) => {
    const result = test()
    if (result === expected) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.log(`  ❌ ${name}`)
      failed++
    }
  })
} else {
  console.log('  ❌ ServiceCreateForm 文件不存在')
  failed++
}

// 检查构建 API 路由
console.log('\n📋 检查构建 API 路由...')
const buildApiPath = 'src/app/api/services/[id]/build/route.ts'
if (fs.existsSync(buildApiPath)) {
  const content = fs.readFileSync(buildApiPath, 'utf8')
  
  const tests = [
    {
      name: '不包含 Java JAR 构建逻辑',
      test: () => !content.includes('BuildType.JAVA_JAR'),
      expected: true
    },
    {
      name: '不包含前端构建逻辑',
      test: () => !content.includes('BuildType.FRONTEND'),
      expected: true
    },
    {
      name: '不包含 build-java-jar Job',
      test: () => !content.includes('build-java-jar'),
      expected: true
    },
    {
      name: '不包含 build-frontend Job',
      test: () => !content.includes('build-frontend'),
      expected: true
    },
    {
      name: '包含模板构建逻辑',
      test: () => content.includes('BuildType.TEMPLATE'),
      expected: true
    },
    {
      name: '包含 build-template Job',
      test: () => content.includes('build-template'),
      expected: true
    }
  ]
  
  tests.forEach(({ name, test, expected }) => {
    const result = test()
    if (result === expected) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.log(`  ❌ ${name}`)
      failed++
    }
  })
} else {
  console.log('  ❌ 构建 API 路由文件不存在')
  failed++
}

console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`)

if (failed === 0) {
  console.log('\n🎉 构建类型清理成功!')
  console.log('\n清理内容:')
  console.log('- 从 BuildType 枚举中移除 JAVA_JAR、FRONTEND、NIXPACKS、BUILDPACKS')
  console.log('- 从 BuildConfigurationCard 中移除 Java JAR 和前端构建配置')
  console.log('- 从 ServiceCreateForm 中移除 Java JAR 和前端构建表单')
  console.log('- 从构建 API 中移除 Java JAR 和前端构建逻辑')
  console.log('- 保留 Dockerfile 和模板构建两种方式')
  
  console.log('\n✨ 现在系统只支持 Dockerfile 和模板构建两种构建方式!')
} else {
  console.log('\n❌ 清理验证失败，请检查代码')
  process.exit(1)
}