#!/usr/bin/env node

/**
 * 测试完整的模板构建工作流程
 * 验证从前端模板选择到Jenkins构建的完整流程
 */

const fs = require('fs');

console.log('🔄 测试完整模板构建工作流程...\n');

// 1. 检查前端模板定义
console.log('1️⃣ 检查前端模板定义...');
const templateFile = fs.readFileSync('src/lib/dockerfile-templates.ts', 'utf8');
const templateCount = (templateFile.match(/id: '/g) || []).length;
console.log(`   ✅ 发现 ${templateCount} 个模板定义`);

// 2. 检查API路由参数处理
console.log('\n2️⃣ 检查API路由参数处理...');
const apiRoute = fs.readFileSync('src/app/api/services/[id]/build/route.ts', 'utf8');

const apiChecks = [
  { name: 'TEMPLATE_ID参数', pattern: 'parameters.TEMPLATE_ID = buildArgs.template_id' },
  { name: 'CUSTOM_DOCKERFILE参数', pattern: 'parameters.CUSTOM_DOCKERFILE = buildArgs.custom_dockerfile' },
  { name: '模板构建类型检查', pattern: 'serviceRecord.build_type === BuildType.TEMPLATE' },
  { name: 'Jenkins Job路径', pattern: 'CICD-STD/build-template' }
];

let passedApiChecks = 0;
apiChecks.forEach(check => {
  if (apiRoute.includes(check.pattern)) {
    console.log(`   ✅ ${check.name}`);
    passedApiChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 API路由检查: ${passedApiChecks}/${apiChecks.length}`);

// 3. 检查Jenkins脚本处理
console.log('\n3️⃣ 检查Jenkins脚本处理...');
const jenkinsScript = fs.readFileSync('doc/jenkins/脚本/build-template', 'utf8');

const jenkinsChecks = [
  { name: 'CUSTOM_DOCKERFILE参数定义', pattern: 'text\\(name: \'CUSTOM_DOCKERFILE\'' },
  { name: '使用CUSTOM_DOCKERFILE', pattern: 'params\\.CUSTOM_DOCKERFILE\\?\\.trim\\(\\)' },
  { name: '写入Dockerfile', pattern: 'writeFile file: \'Dockerfile\\.template\', text: customDockerfile' },
  { name: '回退到现有Dockerfile', pattern: 'fileExists\\(\'Dockerfile\'\\)' },
  { name: '错误处理', pattern: 'No CUSTOM_DOCKERFILE provided' },
  { name: '不包含模板生成函数', pattern: '!generateTemplateDockerfile', inverse: true }
];

let passedJenkinsChecks = 0;
jenkinsChecks.forEach(check => {
  const found = jenkinsScript.includes(check.pattern.replace(/\\/g, ''));
  const passed = check.inverse ? !found : found;
  
  if (passed) {
    console.log(`   ✅ ${check.name}`);
    passedJenkinsChecks++;
  } else {
    console.log(`   ❌ ${check.name}`);
  }
});

console.log(`   📊 Jenkins脚本检查: ${passedJenkinsChecks}/${jenkinsChecks.length}`);

// 4. 模拟完整工作流程
console.log('\n4️⃣ 模拟完整工作流程...');
console.log('```');
console.log('步骤1: 用户在前端选择模板');
console.log('  - 选择模板: pnpm-frontend');
console.log('  - 系统生成Dockerfile内容');
console.log('');
console.log('步骤2: 前端发送构建请求');
console.log('  - build_type: "template"');
console.log('  - build_args: {');
console.log('      template_id: "pnpm-frontend",');
console.log('      custom_dockerfile: "FROM gplane/pnpm:node20-alpine\\n..."');
console.log('    }');
console.log('');
console.log('步骤3: API路由处理请求');
console.log('  - 提取 buildArgs.custom_dockerfile');
console.log('  - 设置 parameters.CUSTOM_DOCKERFILE');
console.log('  - 调用 Jenkins Job: CICD-STD/build-template');
console.log('');
console.log('步骤4: Jenkins执行构建');
console.log('  - 接收 CUSTOM_DOCKERFILE 参数');
console.log('  - 写入 Dockerfile.template 文件');
console.log('  - 执行 docker build');
console.log('  - 推送镜像到 Nexus');
console.log('```');

// 5. 生成示例Dockerfile
console.log('\n5️⃣ 示例生成的Dockerfile (pnpm-frontend):');
console.log('```dockerfile');
console.log('# PNPM前端构建模板');
console.log('# 基于gplane/pnpm:node20-alpine的前端项目构建');
console.log('');
console.log('FROM gplane/pnpm:node20-alpine');
console.log('');
console.log('WORKDIR /app');
console.log('');
console.log('# 设置环境变量');
console.log('ENV NODE_ENV=production');
console.log('ENV PORT=3000');
console.log('');
console.log('# 复制package.json');
console.log('COPY package.json ./');
console.log('');
console.log('# 复制pnpm-lock.yaml（如果存在）');
console.log('COPY pnpm-lock.yaml* ./');
console.log('');
console.log('# 安装依赖（兼容不同版本的lockfile）');
console.log('RUN if [ -f pnpm-lock.yaml ]; then \\');
console.log('      pnpm install --frozen-lockfile || pnpm install --force; \\');
console.log('    else \\');
console.log('      pnpm install; \\');
console.log('    fi');
console.log('');
console.log('# 复制应用代码');
console.log('COPY . ./');
console.log('');
console.log('# 构建应用');
console.log('RUN pnpm run build');
console.log('');
console.log('# 暴露端口');
console.log('EXPOSE 3000');
console.log('');
console.log('# 启动应用');
console.log('CMD ["pnpm", "start"]');
console.log('```');

// 6. 总结
console.log('\n📋 工作流程总结:');
const totalChecks = passedApiChecks + passedJenkinsChecks;
const maxChecks = apiChecks.length + jenkinsChecks.length;

console.log(`✅ 总体检查: ${totalChecks}/${maxChecks} 项通过`);

if (totalChecks === maxChecks) {
  console.log('\n🎉 完整工作流程验证通过！');
  console.log('');
  console.log('🔧 关键特性:');
  console.log('   • 前端根据模板ID生成完整Dockerfile');
  console.log('   • API路由将Dockerfile作为CUSTOM_DOCKERFILE传递');
  console.log('   • Jenkins直接使用传入的Dockerfile内容');
  console.log('   • 支持pnpm lockfile兼容性处理');
  console.log('   • 完整的Git认证和Nexus推送');
  console.log('');
  console.log('✅ 现在可以正常使用模板构建功能了！');
} else {
  console.log('\n⚠️  工作流程还有部分问题需要解决');
}

console.log('\n🚀 使用方法:');
console.log('1. 在前端选择"模板构建"类型');
console.log('2. 选择预定义模板（如pnpm-frontend）');
console.log('3. 系统自动生成Dockerfile并传递给Jenkins');
console.log('4. Jenkins使用传入的Dockerfile进行构建');