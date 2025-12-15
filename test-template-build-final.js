#!/usr/bin/env node

/**
 * 测试模板构建功能的完整实现
 * 验证Git认证、Nexus配置和回调机制是否正确集成
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 测试模板构建完整实现...\n');

// 1. 检查Jenkins脚本是否包含必要的认证配置
console.log('1️⃣ 检查Jenkins脚本认证配置...');
const jenkinsScript = fs.readFileSync('doc/jenkins/脚本/build-template', 'utf8');

const requiredElements = [
  'GIT_CREDENTIALS = \'jenkins-gitlab\'',
  'NEXUS_CREDENTIALS = \'nexus-admin\'',
  'NEXUS_IMAGE_REPO = \'nexus.aimstek.cn\'',
  'credentialsId: env.GIT_CREDENTIALS',
  'SendBuildCallback',
  'PushDockerImage',
  'generateTemplateDockerfile'
];

let missingElements = [];
requiredElements.forEach(element => {
  if (!jenkinsScript.includes(element)) {
    missingElements.push(element);
  }
});

if (missingElements.length === 0) {
  console.log('✅ Jenkins脚本包含所有必要的认证配置');
} else {
  console.log('❌ Jenkins脚本缺少以下配置:');
  missingElements.forEach(element => console.log(`   - ${element}`));
}

// 2. 检查模板定义
console.log('\n2️⃣ 检查模板定义...');
let missingTemplates = [];
const templateScript = jenkinsScript.match(/def generateTemplateDockerfile\(templateId\) \{([\s\S]*?)\n\}/);
if (templateScript) {
  const templateContent = templateScript[1];
  const expectedTemplates = [
    'pnpm-frontend',
    'maven-java21', 
    'nginx-static',
    'node18-standard',
    'python-flask',
    'custom-blank'
  ];
  
  expectedTemplates.forEach(template => {
    if (!templateContent.includes(`case '${template}':`)) {
      missingTemplates.push(template);
    }
  });
  
  if (missingTemplates.length === 0) {
    console.log('✅ 所有模板定义都存在');
  } else {
    console.log('❌ 缺少以下模板定义:');
    missingTemplates.forEach(template => console.log(`   - ${template}`));
  }
} else {
  console.log('❌ 未找到模板生成函数');
}

// 3. 检查参数配置
console.log('\n3️⃣ 检查参数配置...');
const hasParametersBlock = jenkinsScript.includes('parameters {') && 
                          jenkinsScript.includes('TEMPLATE_ID') &&
                          jenkinsScript.includes('CUSTOM_DOCKERFILE');

if (hasParametersBlock) {
  console.log('✅ 参数配置正确');
} else {
  console.log('❌ 参数配置不完整');
}

// 4. 检查回调机制
console.log('\n4️⃣ 检查回调机制...');
const hasCallbackMechanism = jenkinsScript.includes('SendBuildCallback(\'building\'') &&
                            jenkinsScript.includes('SendBuildCallback(\'success\'') &&
                            jenkinsScript.includes('SendBuildCallback(\'failed\'');

if (hasCallbackMechanism) {
  console.log('✅ 回调机制完整');
} else {
  console.log('❌ 回调机制不完整');
}

// 5. 检查Docker构建逻辑
console.log('\n5️⃣ 检查Docker构建逻辑...');
const hasDockerLogic = jenkinsScript.includes('DOCKER_BUILDKIT=0 docker build') &&
                      jenkinsScript.includes('Dockerfile.template') &&
                      jenkinsScript.includes('PushDockerImage');

if (hasDockerLogic) {
  console.log('✅ Docker构建逻辑完整');
} else {
  console.log('❌ Docker构建逻辑不完整');
}

// 6. 检查API路由配置
console.log('\n6️⃣ 检查API路由配置...');
try {
  const apiRoute = fs.readFileSync('src/app/api/services/[id]/build/route.ts', 'utf8');
  const hasTemplateHandling = apiRoute.includes('template') && 
                             apiRoute.includes('TEMPLATE_ID') &&
                             apiRoute.includes('CUSTOM_DOCKERFILE');
  
  if (hasTemplateHandling) {
    console.log('✅ API路由支持模板构建');
  } else {
    console.log('❌ API路由不支持模板构建');
  }
} catch (error) {
  console.log('❌ 无法读取API路由文件');
}

// 7. 生成测试总结
console.log('\n📋 测试总结:');
const allChecks = [
  missingElements.length === 0,
  templateScript && missingTemplates.length === 0,
  hasParametersBlock,
  hasCallbackMechanism,
  hasDockerLogic
];

const passedChecks = allChecks.filter(check => check).length;
const totalChecks = allChecks.length;

console.log(`✅ 通过: ${passedChecks}/${totalChecks} 项检查`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 模板构建功能实现完成！');
  console.log('📝 主要改进:');
  console.log('   • 集成了Git认证 (jenkins-gitlab)');
  console.log('   • 集成了Nexus配置 (nexus-admin)');
  console.log('   • 添加了完整的回调机制');
  console.log('   • 支持6种公司模板');
  console.log('   • 支持自定义Dockerfile');
  console.log('   • 包含参数自动配置');
} else {
  console.log('\n⚠️  还有部分功能需要完善');
}

console.log('\n🔧 使用说明:');
console.log('1. 复制 doc/jenkins/脚本/build-template 到Jenkins');
console.log('2. 创建名为 CICD-STD/build-template 的Job');
console.log('3. 配置Git凭证 jenkins-gitlab');
console.log('4. 配置Nexus凭证 nexus-admin');
console.log('5. 在平台中选择模板进行构建');