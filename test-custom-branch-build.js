#!/usr/bin/env node

/**
 * 测试自定义分支构建功能
 * 验证前端构建对话框和API是否支持自定义分支
 */

const fs = require('fs');

console.log('🌿 测试自定义分支构建功能...\n');

// 1. 检查前端构建对话框是否支持自定义分支
console.log('1️⃣ 检查前端构建对话框...');
const serviceDetailPage = fs.readFileSync('src/app/projects/[id]/services/[serviceId]/page.tsx', 'utf8');

const frontendChecks = [
  { name: 'buildBranch状态定义', pattern: 'buildBranch, setBuildBranch' },
  { name: '分支输入框可编辑', pattern: 'onChange={(e) => setBuildBranch(e.target.value)}' },
  { name: '分支初始化', pattern: 'setBuildBranch(defaultBranch)' },
  { name: '使用自定义分支构建', pattern: 'customBranchValue = buildBranch.trim()' },
  { name: '构建后清理分支状态', pattern: 'setBuildBranch(\'\')' }
];

let passedFrontendChecks = 0;
frontendChecks.forEach(check => {
  if (serviceDetailPage.includes(check.pattern.replace(/\\/g, ''))) {
    console.log(`   ✅ ${check.name}`);
    passedFrontendChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 前端检查: ${passedFrontendChecks}/${frontendChecks.length}`);

// 2. 检查API是否支持分支参数
console.log('\n2️⃣ 检查API分支支持...');
const apiRoute = fs.readFileSync('src/app/api/services/[id]/build/route.ts', 'utf8');

const apiChecks = [
  { name: 'BuildRequestPayload类型', pattern: 'branch?: string' },
  { name: '分支参数提取', pattern: 'payload.branch' },
  { name: '分支默认值处理', pattern: 'branchFromPayload || serviceRecord.git_branch?.trim() || DEFAULT_BRANCH' },
  { name: 'Jenkins参数传递', pattern: 'GIT_BRANCH: branch' }
];

let passedApiChecks = 0;
apiChecks.forEach(check => {
  if (apiRoute.includes(check.pattern.replace(/\\/g, ''))) {
    console.log(`   ✅ ${check.name}`);
    passedApiChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 API检查: ${passedApiChecks}/${apiChecks.length}`);

// 3. 检查Jenkins脚本是否支持分支参数
console.log('\n3️⃣ 检查Jenkins脚本分支支持...');
const jenkinsScript = fs.readFileSync('doc/jenkins/脚本/build-template', 'utf8');

const jenkinsChecks = [
  { name: 'GIT_BRANCH参数定义', pattern: 'string(name: \'GIT_BRANCH\'' },
  { name: '分支参数使用', pattern: 'params.GIT_BRANCH' },
  { name: 'Git checkout分支', pattern: 'branches: [[name: branch]]' },
  { name: '分支默认值', pattern: 'defaultValue: \'main\'' }
];

let passedJenkinsChecks = 0;
jenkinsChecks.forEach(check => {
  if (jenkinsScript.includes(check.pattern.replace(/\\/g, ''))) {
    console.log(`   ✅ ${check.name}`);
    passedJenkinsChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 Jenkins检查: ${passedJenkinsChecks}/${jenkinsChecks.length}`);

// 4. 模拟使用场景
console.log('\n4️⃣ 使用场景模拟...');
console.log('```');
console.log('场景1: 使用默认分支构建');
console.log('  - 用户打开构建对话框');
console.log('  - 分支输入框自动填充服务配置的默认分支 (main)');
console.log('  - 用户直接点击构建');
console.log('  - 系统使用默认分支进行构建');
console.log('');
console.log('场景2: 使用自定义分支构建');
console.log('  - 用户打开构建对话框');
console.log('  - 用户修改分支为 "feature/new-feature"');
console.log('  - 用户点击构建');
console.log('  - 系统使用自定义分支进行构建');
console.log('');
console.log('场景3: 紧急修复分支构建');
console.log('  - 用户打开构建对话框');
console.log('  - 用户修改分支为 "hotfix/critical-bug"');
console.log('  - 用户选择版本类型为 "release"');
console.log('  - 系统使用修复分支构建发布版本');
console.log('```');

// 5. 生成API请求示例
console.log('\n5️⃣ API请求示例...');
console.log('```json');
console.log('POST /api/services/{serviceId}/build');
console.log('Content-Type: application/json');
console.log('');
console.log('{');
console.log('  "branch": "feature/new-feature",');
console.log('  "tag": "dev-20241215120000"');
console.log('}');
console.log('```');

console.log('\n```json');
console.log('Jenkins构建参数:');
console.log('{');
console.log('  "GIT_BRANCH": "feature/new-feature",');
console.log('  "IMAGE_TAG": "dev-20241215120000",');
console.log('  "CUSTOM_DOCKERFILE": "FROM gplane/pnpm:node20-alpine\\n...",');
console.log('  "SERVICE_ID": "service-123",');
console.log('  "GIT_REPOSITORY": "https://gitlab.example.com/project/repo.git"');
console.log('}');
console.log('```');

// 6. 总结
console.log('\n📋 功能总结:');
const totalChecks = passedFrontendChecks + passedApiChecks + passedJenkinsChecks;
const maxChecks = frontendChecks.length + apiChecks.length + jenkinsChecks.length;

console.log(`✅ 总体检查: ${totalChecks}/${maxChecks} 项通过`);

if (totalChecks === maxChecks) {
  console.log('\n🎉 自定义分支构建功能完整实现！');
  console.log('');
  console.log('🌟 主要特性:');
  console.log('   • 构建对话框支持自定义分支输入');
  console.log('   • 自动填充服务配置的默认分支');
  console.log('   • API完整支持分支参数传递');
  console.log('   • Jenkins脚本正确处理分支参数');
  console.log('   • 支持任意Git分支构建');
  console.log('');
  console.log('✅ 用户现在可以灵活选择构建分支了！');
} else {
  console.log('\n⚠️  自定义分支功能还有部分问题需要解决');
}

console.log('\n🚀 使用方法:');
console.log('1. 在服务详情页点击构建按钮');
console.log('2. 在构建对话框中修改分支名称');
console.log('3. 选择版本类型和标签');
console.log('4. 点击开始构建');
console.log('5. 系统使用指定分支进行构建');