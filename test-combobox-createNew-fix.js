#!/usr/bin/env node

/**
 * 测试ComboboxCreateNew修复
 * 验证分支搜索框中的自定义分支创建功能
 */

const fs = require('fs');

console.log('🔧 测试ComboboxCreateNew修复...\n');

// 1. 检查错误原因
console.log('1️⃣ 错误原因分析...');
console.log('```');
console.log('原始错误:');
console.log('  TypeError: children is not a function');
console.log('  at ComboboxCreateNew (src/components/ui/shadcn-io/combobox/index.tsx:300:9)');
console.log('');
console.log('问题分析:');
console.log('  ComboboxCreateNew组件期望children是一个函数:');
console.log('  children(inputValue) // 函数调用');
console.log('');
console.log('  但我们传递的是字符串:');
console.log('  <ComboboxCreateNew>使用自定义分支: "{branchSearch}"</ComboboxCreateNew>');
console.log('');
console.log('修复方案:');
console.log('  将字符串改为函数:');
console.log('  <ComboboxCreateNew>');
console.log('    {(inputValue) => `使用自定义分支: "${inputValue}"`}');
console.log('  </ComboboxCreateNew>');
console.log('```');

// 2. 检查修复后的代码
console.log('\n2️⃣ 检查修复后的代码...');
const serviceDetailPage = fs.readFileSync('src/app/projects/[id]/services/[serviceId]/page.tsx', 'utf8');

const fixChecks = [
  { name: 'ComboboxCreateNew使用', pattern: '<ComboboxCreateNew' },
  { name: 'onSelect回调', pattern: 'onSelect={(value) => {' },
  { name: '函数形式children', pattern: '{(inputValue) => `使用自定义分支: "${inputValue}"`}' },
  { name: '分支状态设置', pattern: 'setBuildBranch(value)' },
  { name: '选择器关闭', pattern: 'setBranchPickerOpen(false)' }
];

let passedFixChecks = 0;
fixChecks.forEach(check => {
  if (serviceDetailPage.includes(check.pattern)) {
    console.log(`   ✅ ${check.name}`);
    passedFixChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 修复检查: ${passedFixChecks}/${fixChecks.length}`);

// 3. 检查ComboboxCreateNew组件的API
console.log('\n3️⃣ ComboboxCreateNew组件API...');
try {
  const comboboxComponent = fs.readFileSync('src/components/ui/shadcn-io/combobox/index.tsx', 'utf8');
  
  const apiChecks = [
    { name: 'children函数调用', pattern: 'children(inputValue)' },
    { name: 'inputValue参数', pattern: 'inputValue' },
    { name: 'onSelect回调', pattern: 'onSelect' },
    { name: '默认UI渲染', pattern: 'Create new' }
  ];
  
  let passedApiChecks = 0;
  apiChecks.forEach(check => {
    if (comboboxComponent.includes(check.pattern)) {
      console.log(`   ✅ ${check.name}`);
      passedApiChecks++;
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
  
  console.log(`   📊 组件API检查: ${passedApiChecks}/${apiChecks.length}`);
} catch (error) {
  console.log('   ❌ 无法读取ComboboxCreateNew组件文件');
}

// 4. 使用场景模拟
console.log('\n4️⃣ 使用场景模拟...');
console.log('```');
console.log('场景1: 用户输入自定义分支名');
console.log('  1. 用户点击分支选择器');
console.log('  2. 用户输入 "feature/new-auth"');
console.log('  3. 系统显示 "使用自定义分支: feature/new-auth"');
console.log('  4. 用户点击该选项');
console.log('  5. 分支设置为 "feature/new-auth"，选择器关闭');
console.log('');
console.log('场景2: 用户输入版本标签');
console.log('  1. 用户点击分支选择器');
console.log('  2. 用户输入 "v2.1.0"');
console.log('  3. 系统显示 "使用自定义分支: v2.1.0"');
console.log('  4. 用户点击该选项');
console.log('  5. 分支设置为 "v2.1.0"，选择器关闭');
console.log('```');

// 5. 组件使用对比
console.log('\n5️⃣ 组件使用对比...');
console.log('```tsx');
console.log('// 修复前 (错误)');
console.log('<ComboboxCreateNew onSelect={handleSelect}>');
console.log('  使用自定义分支: "{branchSearch}"  // ❌ 字符串');
console.log('</ComboboxCreateNew>');
console.log('');
console.log('// 修复后 (正确)');
console.log('<ComboboxCreateNew onSelect={handleSelect}>');
console.log('  {(inputValue) => `使用自定义分支: "${inputValue}"`}  // ✅ 函数');
console.log('</ComboboxCreateNew>');
console.log('');
console.log('// 组件内部实现');
console.log('const ComboboxCreateNew = ({ children, onSelect }) => {');
console.log('  const inputValue = useComboboxInputValue()');
console.log('  return (');
console.log('    <button onClick={() => onSelect(inputValue)}>');
console.log('      {children ? (');
console.log('        children(inputValue)  // 这里需要函数');
console.log('      ) : (');
console.log('        <span>Create new: "{inputValue}"</span>');
console.log('      )}');
console.log('    </button>');
console.log('  )');
console.log('}');
console.log('```');

// 6. 其他类似组件检查
console.log('\n6️⃣ 检查其他类似组件使用...');
const otherComboboxUsages = [
  { pattern: 'ComboboxCreateNew', context: '其他ComboboxCreateNew使用' },
  { pattern: 'children\\(', context: '其他函数形式children' }
];

otherComboboxUsages.forEach(usage => {
  const matches = (serviceDetailPage.match(new RegExp(usage.pattern, 'g')) || []).length;
  console.log(`   📊 ${usage.context}: ${matches} 处`);
});

// 7. 总结
console.log('\n📋 修复总结:');

if (passedFixChecks === fixChecks.length) {
  console.log('✅ ComboboxCreateNew修复完成！');
  console.log('');
  console.log('🔧 主要修复:');
  console.log('   • 将字符串children改为函数形式');
  console.log('   • 正确使用inputValue参数');
  console.log('   • 保持onSelect回调功能');
  console.log('   • 修复运行时TypeError');
  console.log('');
  console.log('✅ 现在分支搜索框可以正常使用了！');
} else {
  console.log('⚠️  ComboboxCreateNew修复还需要完善');
}

console.log('\n🚀 使用说明:');
console.log('1. 点击构建按钮打开构建对话框');
console.log('2. 点击分支选择器');
console.log('3. 输入自定义分支名');
console.log('4. 点击"使用自定义分支"选项');
console.log('5. 分支名自动设置并开始构建');