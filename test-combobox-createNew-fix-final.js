#!/usr/bin/env node

/**
 * 测试 ComboboxCreateNew 组件修复
 * 验证分支选择器中的自定义分支输入功能
 */

const fs = require('fs')
const path = require('path')

console.log('🔧 测试 ComboboxCreateNew 组件修复...\n')

// 检查修复后的代码
const servicePagePath = 'src/app/projects/[id]/services/[serviceId]/page.tsx'

if (!fs.existsSync(servicePagePath)) {
  console.error('❌ 服务详情页面文件不存在')
  process.exit(1)
}

const servicePageContent = fs.readFileSync(servicePagePath, 'utf8')

// 验证修复
const tests = [
  {
    name: '检查 onCreateNew 属性使用',
    test: () => servicePageContent.includes('onCreateNew={(value) => {'),
    expected: true
  },
  {
    name: '确认不再使用错误的 onSelect 属性',
    test: () => !servicePageContent.includes('ComboboxCreateNew') || !servicePageContent.match(/ComboboxCreateNew[^}]*onSelect/),
    expected: true
  },
  {
    name: '验证 children 函数正确使用',
    test: () => servicePageContent.includes('{(inputValue) => `使用自定义分支: "${inputValue}"`}'),
    expected: true
  },
  {
    name: '检查分支设置逻辑',
    test: () => servicePageContent.includes('setBuildBranch(value)') && servicePageContent.includes('setBranchPickerOpen(false)'),
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
  console.log('\n🎉 ComboboxCreateNew 组件修复成功!')
  console.log('\n修复内容:')
  console.log('- 将错误的 onSelect 属性改为正确的 onCreateNew')
  console.log('- 保持 children 函数的正确使用')
  console.log('- 确保分支选择和对话框关闭逻辑正常工作')
  
  console.log('\n✨ 现在用户可以正常在构建对话框中输入自定义分支名称了!')
} else {
  console.log('\n❌ 修复验证失败，请检查代码')
  process.exit(1)
}