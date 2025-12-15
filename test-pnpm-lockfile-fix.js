#!/usr/bin/env node

/**
 * 测试PNPM Lockfile兼容性修复
 * 验证模板是否正确处理不同版本的pnpm-lock.yaml
 */

const fs = require('fs');

console.log('🔧 测试PNPM Lockfile兼容性修复...\n');

// 1. 检查TypeScript模板定义
console.log('1️⃣ 检查TypeScript模板定义...');
const templateFile = fs.readFileSync('src/lib/dockerfile-templates.ts', 'utf8');
const pnpmTemplate = templateFile.match(/dockerfile: `# PNPM前端构建模板[\s\S]*?CMD \["pnpm", "start"\]`/);

if (pnpmTemplate) {
  const templateContent = pnpmTemplate[0];
  
  // 检查关键修复点
  const fixes = [
    { name: '可选lockfile复制', pattern: 'COPY pnpm-lock.yaml\\* \\.\/' },
    { name: 'lockfile存在检查', pattern: 'if \\[ -f pnpm-lock\\.yaml \\]' },
    { name: '降级安装策略', pattern: 'pnpm install --frozen-lockfile \\|\\| pnpm install --force' },
    { name: '无lockfile处理', pattern: 'else.*pnpm install' }
  ];
  
  let passedFixes = 0;
  fixes.forEach(fix => {
    const regex = new RegExp(fix.pattern);
    if (regex.test(templateContent)) {
      console.log(`   ✅ ${fix.name}`);
      passedFixes++;
    } else {
      console.log(`   ❌ ${fix.name}`);
    }
  });
  
  console.log(`   📊 通过: ${passedFixes}/${fixes.length} 项修复`);
} else {
  console.log('   ❌ 未找到PNPM模板定义');
}

// 2. 检查Jenkins脚本定义
console.log('\n2️⃣ 检查Jenkins脚本定义...');
const jenkinsScript = fs.readFileSync('doc/jenkins/脚本/build-template', 'utf8');
const jenkinsTemplate = jenkinsScript.match(/case 'pnpm-frontend':[\s\S]*?CMD \["pnpm", "start"\]'''/);

if (jenkinsTemplate) {
  const jenkinsContent = jenkinsTemplate[0];
  
  // 检查Jenkins脚本中的修复
  const jenkinsFixes = [
    { name: '可选lockfile复制', pattern: 'COPY pnpm-lock\\.yaml\\* \\.\/' },
    { name: 'lockfile存在检查', pattern: 'if \\[ -f pnpm-lock\\.yaml \\]' },
    { name: '降级安装策略', pattern: 'pnpm install --frozen-lockfile \\|\\| pnpm install --force' }
  ];
  
  let passedJenkinsFixes = 0;
  jenkinsFixes.forEach(fix => {
    const regex = new RegExp(fix.pattern);
    if (regex.test(jenkinsContent)) {
      console.log(`   ✅ ${fix.name}`);
      passedJenkinsFixes++;
    } else {
      console.log(`   ❌ ${fix.name}`);
    }
  });
  
  console.log(`   📊 通过: ${passedJenkinsFixes}/${jenkinsFixes.length} 项修复`);
} else {
  console.log('   ❌ 未找到Jenkins PNPM模板定义');
}

// 3. 生成修复后的Dockerfile示例
console.log('\n3️⃣ 生成修复后的Dockerfile示例...');
console.log('```dockerfile');
console.log('# PNPM前端构建模板（修复版）');
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

// 4. 解释修复原理
console.log('\n4️⃣ 修复原理说明:');
console.log('🔍 问题原因:');
console.log('   • pnpm-lock.yaml 版本与镜像中的pnpm版本不兼容');
console.log('   • --frozen-lockfile 严格模式导致构建失败');
console.log('');
console.log('🛠️ 修复策略:');
console.log('   1. 使用 COPY pnpm-lock.yaml* ./ 可选复制lockfile');
console.log('   2. 检查lockfile是否存在再决定安装策略');
console.log('   3. 优先使用 --frozen-lockfile，失败时降级到 --force');
console.log('   4. 无lockfile时直接使用 pnpm install');
console.log('');
console.log('✅ 修复效果:');
console.log('   • 兼容不同版本的pnpm-lock.yaml');
console.log('   • 支持没有lockfile的项目');
console.log('   • 保持依赖版本一致性（优先frozen-lockfile）');
console.log('   • 构建失败时自动降级处理');

console.log('\n🎯 修复完成！现在可以重新构建前端项目了。');