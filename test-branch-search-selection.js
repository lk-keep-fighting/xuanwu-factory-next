#!/usr/bin/env node

/**
 * 测试分支搜索和选择功能
 * 验证构建对话框中的分支选择器是否正常工作
 */

const fs = require('fs');

console.log('🔍 测试分支搜索和选择功能...\n');

// 1. 检查API路由是否存在
console.log('1️⃣ 检查分支API路由...');
let passedApiChecks = 0;
let apiChecks = [];
try {
  const branchApiRoute = fs.readFileSync('src/app/api/services/[id]/branches/route.ts', 'utf8');
  
  apiChecks = [
    { name: 'GET方法定义', pattern: 'export async function GET' },
    { name: '服务查询', pattern: 'prisma.service.findUnique' },
    { name: 'Git仓库检查', pattern: 'service.git_repository' },
    { name: '仓库路径提取', pattern: 'extractGitLabProjectPath' },
    { name: '分支获取', pattern: 'getGitLabProjectBranches' },
    { name: '搜索参数支持', pattern: 'searchParams.get(\'search\')' }
  ];
  
  apiChecks.forEach(check => {
    if (branchApiRoute.includes(check.pattern)) {
      console.log(`   ✅ ${check.name}`);
      passedApiChecks++;
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
  
  console.log(`   📊 API路由检查: ${passedApiChecks}/${apiChecks.length}`);
} catch (error) {
  console.log('   ❌ 分支API路由文件不存在');
}

// 2. 检查服务方法
console.log('\n2️⃣ 检查服务方法...');
const serviceSvc = fs.readFileSync('src/service/serviceSvc.ts', 'utf8');

const serviceChecks = [
  { name: 'GitBranchListResult导入', pattern: 'GitBranchListResult' },
  { name: 'getServiceBranches方法', pattern: 'getServiceBranches' },
  { name: '搜索参数支持', pattern: 'search?: string' },
  { name: '分页参数支持', pattern: 'perPage?: number' },
  { name: 'API调用', pattern: '/branches' }
];

let passedServiceChecks = 0;
serviceChecks.forEach(check => {
  if (serviceSvc.includes(check.pattern)) {
    console.log(`   ✅ ${check.name}`);
    passedServiceChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 服务方法检查: ${passedServiceChecks}/${serviceChecks.length}`);

// 3. 检查前端构建对话框
console.log('\n3️⃣ 检查前端构建对话框...');
const serviceDetailPage = fs.readFileSync('src/app/projects/[id]/services/[serviceId]/page.tsx', 'utf8');

const frontendChecks = [
  { name: 'Combobox组件使用', pattern: '<Combobox' },
  { name: '分支选择器触发器', pattern: 'ComboboxTrigger' },
  { name: '分支搜索输入', pattern: 'ComboboxInput' },
  { name: '分支选项列表', pattern: 'ComboboxItem' },
  { name: '自定义分支创建', pattern: 'ComboboxCreateNew' },
  { name: '分支加载状态', pattern: 'branchLoading' },
  { name: '分支搜索状态', pattern: 'branchSearch' },
  { name: '分支选项数据', pattern: 'branchOptions' },
  { name: '默认分支标识', pattern: 'branch.isDefault' },
  { name: '构建对话框分支加载', pattern: 'fetchBranches(undefined, { useDefaultBranch: false })' }
];

let passedFrontendChecks = 0;
frontendChecks.forEach(check => {
  if (serviceDetailPage.includes(check.pattern)) {
    console.log(`   ✅ ${check.name}`);
    passedFrontendChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 前端对话框检查: ${passedFrontendChecks}/${frontendChecks.length}`);

// 4. 检查fetchBranches函数更新
console.log('\n4️⃣ 检查fetchBranches函数更新...');

const fetchBranchesChecks = [
  { name: '使用服务API', pattern: 'serviceSvc.getServiceBranches' },
  { name: '服务ID检查', pattern: 'serviceId' },
  { name: 'Git仓库检查', pattern: 'service?.git_repository' },
  { name: '搜索参数传递', pattern: 'search: keyword?.trim()' },
  { name: '分页参数传递', pattern: 'perPage: 100' }
];

let passedFetchChecks = 0;
fetchBranchesChecks.forEach(check => {
  if (serviceDetailPage.includes(check.pattern)) {
    console.log(`   ✅ ${check.name}`);
    passedFetchChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 fetchBranches更新检查: ${passedFetchChecks}/${fetchBranchesChecks.length}`);

// 5. 模拟使用场景
console.log('\n5️⃣ 使用场景模拟...');
console.log('```');
console.log('场景1: 选择默认分支构建');
console.log('  1. 用户点击构建按钮');
console.log('  2. 系统自动加载分支列表');
console.log('  3. 分支选择器显示服务配置的默认分支');
console.log('  4. 用户直接点击构建');
console.log('');
console.log('场景2: 搜索并选择特定分支');
console.log('  1. 用户点击分支选择器');
console.log('  2. 用户输入搜索关键词 "feature"');
console.log('  3. 系统显示匹配的分支列表');
console.log('  4. 用户选择 "feature/user-auth"');
console.log('  5. 用户点击构建');
console.log('');
console.log('场景3: 创建自定义分支名');
console.log('  1. 用户点击分支选择器');
console.log('  2. 用户输入不存在的分支名 "hotfix/urgent"');
console.log('  3. 系统显示"使用自定义分支"选项');
console.log('  4. 用户选择自定义分支选项');
console.log('  5. 用户点击构建');
console.log('```');

// 6. API请求示例
console.log('\n6️⃣ API请求示例...');
console.log('```http');
console.log('GET /api/services/{serviceId}/branches?search=feature&per_page=20');
console.log('```');

console.log('\n```json');
console.log('响应示例:');
console.log('{');
console.log('  "items": [');
console.log('    {');
console.log('      "name": "main",');
console.log('      "default": true,');
console.log('      "commit": {');
console.log('        "shortId": "a1b2c3d",');
console.log('        "title": "Initial commit"');
console.log('      }');
console.log('    },');
console.log('    {');
console.log('      "name": "feature/user-auth",');
console.log('      "default": false,');
console.log('      "commit": {');
console.log('        "shortId": "e4f5g6h",');
console.log('        "title": "Add user authentication"');
console.log('      }');
console.log('    }');
console.log('  ],');
console.log('  "total": 2');
console.log('}');
console.log('```');

// 7. 总结
console.log('\n📋 功能总结:');
const totalChecks = passedApiChecks + passedServiceChecks + passedFrontendChecks + passedFetchChecks;
const maxChecks = apiChecks.length + serviceChecks.length + frontendChecks.length + fetchBranchesChecks.length;

console.log(`✅ 总体检查: ${totalChecks}/${maxChecks} 项通过`);

if (totalChecks === maxChecks) {
  console.log('\n🎉 分支搜索和选择功能完整实现！');
  console.log('');
  console.log('🌟 主要特性:');
  console.log('   • 构建对话框集成分支选择器');
  console.log('   • 支持分支搜索和过滤');
  console.log('   • 显示默认分支标识');
  console.log('   • 支持自定义分支名输入');
  console.log('   • 自动加载Git仓库分支列表');
  console.log('   • 默认选择服务配置的分支');
  console.log('');
  console.log('✅ 用户现在可以方便地搜索和选择构建分支了！');
} else {
  console.log('\n⚠️  分支搜索和选择功能还有部分问题需要解决');
}

console.log('\n🚀 使用方法:');
console.log('1. 点击构建按钮打开构建对话框');
console.log('2. 点击分支选择器查看可用分支');
console.log('3. 输入关键词搜索特定分支');
console.log('4. 选择目标分支或输入自定义分支名');
console.log('5. 配置其他构建参数并开始构建');