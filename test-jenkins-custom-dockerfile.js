#!/usr/bin/env node

/**
 * 测试Jenkins脚本只使用CUSTOM_DOCKERFILE的修改
 * 验证不再根据模板ID生成Dockerfile
 */

const fs = require('fs');

console.log('🧪 测试Jenkins脚本CUSTOM_DOCKERFILE修改...\n');

// 1. 检查Jenkins脚本是否移除了模板生成函数
console.log('1️⃣ 检查模板生成函数是否已移除...');
const jenkinsScript = fs.readFileSync('doc/jenkins/脚本/build-template', 'utf8');

const removedElements = [
  'generateTemplateDockerfile',
  'case \'pnpm-frontend\'',
  'case \'maven-java21\'',
  'case \'nginx-static\'',
  'TEMPLATE_ID'
];

let foundElements = [];
removedElements.forEach(element => {
  if (jenkinsScript.includes(element)) {
    foundElements.push(element);
  }
});

if (foundElements.length === 0) {
  console.log('✅ 所有模板生成相关代码已移除');
} else {
  console.log('❌ 仍然包含以下模板生成代码:');
  foundElements.forEach(element => console.log(`   - ${element}`));
}

// 2. 检查是否只使用CUSTOM_DOCKERFILE
console.log('\n2️⃣ 检查CUSTOM_DOCKERFILE使用逻辑...');
const requiredLogic = [
  'params.CUSTOM_DOCKERFILE?.trim()',
  'writeFile file: \'Dockerfile.template\', text: customDockerfile',
  'fileExists(\'Dockerfile\')',
  'No CUSTOM_DOCKERFILE provided and no Dockerfile found'
];

let missingLogic = [];
requiredLogic.forEach(logic => {
  if (!jenkinsScript.includes(logic)) {
    missingLogic.push(logic);
  }
});

if (missingLogic.length === 0) {
  console.log('✅ CUSTOM_DOCKERFILE逻辑完整');
} else {
  console.log('❌ 缺少以下逻辑:');
  missingLogic.forEach(logic => console.log(`   - ${logic}`));
}

// 3. 检查参数定义
console.log('\n3️⃣ 检查参数定义...');
const hasCustomDockerfileParam = jenkinsScript.includes('text(name: \'CUSTOM_DOCKERFILE\'');
const hasTemplateIdParam = jenkinsScript.includes('string(name: \'TEMPLATE_ID\'');

if (hasCustomDockerfileParam) {
  console.log('✅ CUSTOM_DOCKERFILE参数存在');
} else {
  console.log('❌ CUSTOM_DOCKERFILE参数缺失');
}

if (hasTemplateIdParam) {
  console.log('⚠️  TEMPLATE_ID参数仍然存在（可以保留用于兼容性）');
} else {
  console.log('✅ TEMPLATE_ID参数已移除');
}

// 4. 检查Prepare Dockerfile阶段
console.log('\n4️⃣ 检查Prepare Dockerfile阶段...');
const prepareStage = jenkinsScript.match(/stage\('Prepare Dockerfile'\) \{[\s\S]*?\}\s*\}/);
if (prepareStage) {
  const stageContent = prepareStage[0];
  
  const stageChecks = [
    { name: '使用CUSTOM_DOCKERFILE', pattern: 'if \\(customDockerfile\\)' },
    { name: '检查现有Dockerfile', pattern: 'fileExists\\(\'Dockerfile\'\\)' },
    { name: '错误处理', pattern: 'No CUSTOM_DOCKERFILE provided' },
    { name: '不包含模板生成', pattern: '!generateTemplateDockerfile', inverse: true }
  ];
  
  let passedStageChecks = 0;
  stageChecks.forEach(check => {
    const regex = new RegExp(check.pattern);
    const found = regex.test(stageContent);
    const passed = check.inverse ? !found : found;
    
    if (passed) {
      console.log(`   ✅ ${check.name}`);
      passedStageChecks++;
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
  
  console.log(`   📊 通过: ${passedStageChecks}/${stageChecks.length} 项检查`);
} else {
  console.log('   ❌ 未找到Prepare Dockerfile阶段');
}

// 5. 生成使用示例
console.log('\n5️⃣ 使用示例:');
console.log('```groovy');
console.log('// Jenkins构建参数');
console.log('CUSTOM_DOCKERFILE = """');
console.log('FROM gplane/pnpm:node20-alpine');
console.log('WORKDIR /app');
console.log('COPY package.json ./');
console.log('COPY pnpm-lock.yaml* ./');
console.log('RUN if [ -f pnpm-lock.yaml ]; then \\');
console.log('      pnpm install --frozen-lockfile || pnpm install --force; \\');
console.log('    else \\');
console.log('      pnpm install; \\');
console.log('    fi');
console.log('COPY . ./');
console.log('RUN pnpm run build');
console.log('EXPOSE 3000');
console.log('CMD ["pnpm", "start"]');
console.log('"""');
console.log('```');

// 6. 总结
console.log('\n📋 修改总结:');
const allChecks = [
  foundElements.length === 0,
  missingLogic.length === 0,
  hasCustomDockerfileParam,
  prepareStage !== null
];

const passedChecks = allChecks.filter(check => check).length;
const totalChecks = allChecks.length;

console.log(`✅ 通过: ${passedChecks}/${totalChecks} 项检查`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 Jenkins脚本修改完成！');
  console.log('📝 主要变更:');
  console.log('   • 移除了模板ID生成逻辑');
  console.log('   • 只使用传入的CUSTOM_DOCKERFILE');
  console.log('   • 保留现有Dockerfile的回退机制');
  console.log('   • 简化了构建流程');
} else {
  console.log('\n⚠️  还有部分修改需要完善');
}

console.log('\n🔧 工作流程:');
console.log('1. 前端根据模板ID生成Dockerfile内容');
console.log('2. 将生成的Dockerfile作为CUSTOM_DOCKERFILE传给Jenkins');
console.log('3. Jenkins直接使用传入的Dockerfile内容构建');
console.log('4. 不再在Jenkins中进行模板生成');