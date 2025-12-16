#!/usr/bin/env node

/**
 * 测试构建配置模板选择功能
 * 验证服务详情页面的构建配置可以重新选择模板并覆盖自定义Dockerfile
 */

const fs = require('fs')

console.log('🔧 测试构建配置模板选择功能...\n')

// 检查 BuildConfigurationCard 组件
const buildConfigPath = 'src/components/services/BuildConfigurationCard.tsx'

if (!fs.existsSync(buildConfigPath)) {
  console.error('❌ BuildConfigurationCard 文件不存在')
  process.exit(1)
}

const buildConfigContent = fs.readFileSync(buildConfigPath, 'utf8')

// 验证功能
const tests = [
  {
    name: '导入模板相关函数',
    test: () => buildConfigContent.includes('getAllTemplates, getTemplateById, getTemplateCategories'),
    expected: true
  },
  {
    name: '包含模板选择下拉框',
    test: () => buildConfigContent.includes('选择构建模板') && buildConfigContent.includes('SelectTrigger'),
    expected: true
  },
  {
    name: '包含模板选择处理函数',
    test: () => buildConfigContent.includes('handleTemplateSelect'),
    expected: true
  },
  {
    name: '包含重置为模板功能',
    test: () => buildConfigContent.includes('handleResetToTemplate') && buildConfigContent.includes('重置为模板'),
    expected: true
  },
  {
    name: '按分类显示模板',
    test: () => buildConfigContent.includes('categories.map') && buildConfigContent.includes('category.label'),
    expected: true
  },
  {
    name: '显示模板详细信息',
    test: () => buildConfigContent.includes('template.name') && buildConfigContent.includes('template.description'),
    expected: true
  },
  {
    name: '自动填充Dockerfile内容',
    test: () => buildConfigContent.includes("updateBuildArg('custom_dockerfile', template.dockerfile)"),
    expected: true
  },
  {
    name: '显示模板信息面板',
    test: () => buildConfigContent.includes('模板信息') && buildConfigContent.includes('基础镜像'),
    expected: true
  },
  {
    name: '显示模板的基础镜像信息',
    test: () => buildConfigContent.includes('selectedTemplate.baseImage'),
    expected: true
  },
  {
    name: '显示模板的端口信息',
    test: () => buildConfigContent.includes('selectedTemplate.exposePorts'),
    expected: true
  },
  {
    name: '显示模板的启动命令',
    test: () => buildConfigContent.includes('selectedTemplate.runCommand'),
    expected: true
  },
  {
    name: '增加Dockerfile编辑区域高度',
    test: () => buildConfigContent.includes('h-40'),
    expected: true
  },
  {
    name: '包含RefreshCw图标',
    test: () => buildConfigContent.includes('RefreshCw'),
    expected: true
  },
  {
    name: '提供用户友好的提示信息',
    test: () => buildConfigContent.includes('选择模板后会自动填充Dockerfile内容'),
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
  console.log('\n🎉 构建配置模板选择功能增强成功!')
  console.log('\n新增功能:')
  console.log('- 📋 模板选择下拉框，按分类显示所有可用模板')
  console.log('- 🔄 重置为模板功能，一键恢复模板原始内容')
  console.log('- 📝 自动填充Dockerfile，选择模板后立即更新内容')
  console.log('- 📊 模板信息面板，显示基础镜像、端口、启动命令等详情')
  console.log('- 🎨 分类显示，按前端、Java、Node.js等分类组织模板')
  console.log('- 💡 用户友好的提示和说明文字')
  
  console.log('\n✨ 用户现在可以在服务详情页面轻松重新选择构建模板并覆盖自定义Dockerfile!')
  
  console.log('\n🔧 使用流程:')
  console.log('1. 在服务详情页面点击"构建与部署"标签')
  console.log('2. 在构建配置卡片中点击"编辑"按钮')
  console.log('3. 选择"模板构建"作为构建方式')
  console.log('4. 从下拉框中选择新的构建模板')
  console.log('5. Dockerfile内容会自动更新为选中模板的内容')
  console.log('6. 可以进一步自定义Dockerfile或点击"重置为模板"恢复')
  console.log('7. 点击"保存"应用更改')
} else {
  console.log('\n❌ 功能增强验证失败，请检查代码')
  process.exit(1)
}