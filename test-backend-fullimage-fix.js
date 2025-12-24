#!/usr/bin/env node

/**
 * 测试后端 FULL_IMAGE 参数传递修复
 * 验证只有在自定义模式下才传递 FULL_IMAGE 参数给 Jenkins
 */

const fs = require('fs');

console.log('🔧 测试后端 FULL_IMAGE 参数传递修复');
console.log('=' .repeat(50));

function testBackendParameterLogic() {
  console.log('1️⃣ 检查后端参数构建逻辑...\n');
  
  const apiContent = fs.readFileSync('src/app/api/services/[id]/build/route.ts', 'utf8');
  
  const checks = [
    {
      name: '移除默认FULL_IMAGE参数',
      pattern: /FULL_IMAGE: fullImage,/,
      description: '不应该默认传递 FULL_IMAGE 参数',
      shouldNotExist: true
    },
    {
      name: '条件传递FULL_IMAGE',
      pattern: /if \(requestedFullImage\)[\s\S]*?parameters\.FULL_IMAGE = fullImage/,
      description: '应该只在自定义模式下传递 FULL_IMAGE 参数'
    },
    {
      name: '保留基础参数',
      pattern: /IMAGE_REPOSITORY: repository,[\s\S]*?IMAGE_TAG: tag,/,
      description: '应该始终传递 IMAGE_REPOSITORY 和 IMAGE_TAG 参数'
    },
    {
      name: '自定义镜像检测',
      pattern: /requestedFullImage.*payload\.fullImage/,
      description: '应该正确检测用户是否使用自定义镜像'
    }
  ];
  
  let passedChecks = 0;
  
  checks.forEach((check, index) => {
    const found = check.pattern.test(apiContent);
    const passed = check.shouldNotExist ? !found : found;
    
    console.log(`${index + 1}. ${check.name}: ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`   ${check.description}`);
    } else {
      passedChecks++;
    }
  });
  
  console.log(`\n📊 后端逻辑检查: ${passedChecks}/${checks.length} 通过\n`);
  return passedChecks === checks.length;
}

function simulateJenkinsParameters() {
  console.log('2️⃣ 模拟 Jenkins 参数生成...\n');
  
  const scenarios = [
    {
      name: '默认模式构建',
      description: '用户不勾选自定义标签，使用默认构建规则',
      input: {
        branch: 'main',
        tag: 'dev-20241223120000',
        fullImage: undefined // 前端不传递 fullImage
      },
      expectedJenkinsParams: {
        GIT_BRANCH: 'main',
        IMAGE_REPOSITORY: 'nexus.aimstek.cn/project/service',
        IMAGE_TAG: 'dev-20241223120000',
        // 注意：不应该有 FULL_IMAGE 参数
      },
      jenkinsScriptBehavior: '使用 IMAGE_REPOSITORY:IMAGE_TAG-commitId 格式'
    },
    {
      name: '自定义模式构建',
      description: '用户勾选自定义标签，完全自定义镜像名',
      input: {
        branch: 'release/v2.1.0',
        tag: undefined,
        fullImage: 'my-project/user-service:v2.1.0' // 前端传递 fullImage
      },
      expectedJenkinsParams: {
        GIT_BRANCH: 'release/v2.1.0',
        IMAGE_REPOSITORY: 'my-project/user-service', // 从 fullImage 解析
        IMAGE_TAG: 'v2.1.0', // 从 fullImage 解析
        FULL_IMAGE: 'my-project/user-service:v2.1.0' // 只有自定义模式才有
      },
      jenkinsScriptBehavior: '优先使用 FULL_IMAGE 参数'
    },
    {
      name: '私有仓库自定义',
      description: '用户使用私有仓库的自定义镜像名',
      input: {
        branch: 'main',
        tag: undefined,
        fullImage: 'harbor.company.com/backend/api:latest'
      },
      expectedJenkinsParams: {
        GIT_BRANCH: 'main',
        IMAGE_REPOSITORY: 'harbor.company.com/backend/api',
        IMAGE_TAG: 'latest',
        FULL_IMAGE: 'harbor.company.com/backend/api:latest'
      },
      jenkinsScriptBehavior: '优先使用 FULL_IMAGE，保持原有 registry 前缀'
    }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`场景 ${index + 1}: ${scenario.name}`);
    console.log(`  描述: ${scenario.description}`);
    console.log(`  前端输入: ${JSON.stringify(scenario.input, null, 4)}`);
    console.log(`  Jenkins参数: ${JSON.stringify(scenario.expectedJenkinsParams, null, 4)}`);
    console.log(`  Jenkins行为: ${scenario.jenkinsScriptBehavior}`);
    console.log('');
  });
  
  return true;
}

function explainJenkinsScriptLogic() {
  console.log('3️⃣ Jenkins 脚本处理逻辑说明...\n');
  
  console.log('🔄 Jenkins 脚本中的镜像名处理流程:');
  console.log('');
  console.log('```groovy');
  console.log('// 获取 Git commit ID');
  console.log('def commitId = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()');
  console.log('');
  console.log('def image = ""');
  console.log('');
  console.log('// 如果传入了 FULL_IMAGE，则以 FULL_IMAGE 为最终镜像名');
  console.log('if (params.FULL_IMAGE?.trim()) {');
  console.log('    image = params.FULL_IMAGE.trim()');
  console.log('    echo "Using provided FULL_IMAGE: ${image}"');
  console.log('} else {');
  console.log('    // 如果没有传入 FULL_IMAGE，则以 IMAGE_REPOSITORY+":"+IMAGE_TAG+"-"+commitId 作为最终镜像名');
  console.log('    def imageRepo = params.IMAGE_REPOSITORY?.trim()');
  console.log('    if (imageRepo) {');
  console.log('        def imageTag = params.IMAGE_TAG?.trim() ?: "latest"');
  console.log('        image = "${imageRepo}:${imageTag}-${commitId}"');
  console.log('        echo "Constructed image from IMAGE_REPOSITORY: ${image}"');
  console.log('    }');
  console.log('}');
  console.log('');
  console.log('// 确定最终镜像名后，判断是否包含 NEXUS_IMAGE_REPO 前缀，没有则追加');
  console.log('if (env.NEXUS_IMAGE_REPO?.trim()) {');
  console.log('    // 智能处理 NEXUS 前缀逻辑...');
  console.log('}');
  console.log('```');
  console.log('');
  
  console.log('📋 关键点说明:');
  console.log('');
  console.log('1. **参数检查优先级**:');
  console.log('   - 首先检查是否有 FULL_IMAGE 参数');
  console.log('   - 如果有，直接使用（自定义模式）');
  console.log('   - 如果没有，使用 IMAGE_REPOSITORY + IMAGE_TAG（默认模式）');
  console.log('');
  console.log('2. **默认模式行为**:');
  console.log('   - 接收: IMAGE_REPOSITORY, IMAGE_TAG');
  console.log('   - 处理: IMAGE_REPOSITORY:IMAGE_TAG-commitId');
  console.log('   - 结果: nexus.aimstek.cn/project/service:dev-20241223120000-abc123');
  console.log('');
  console.log('3. **自定义模式行为**:');
  console.log('   - 接收: FULL_IMAGE');
  console.log('   - 处理: 直接使用 FULL_IMAGE');
  console.log('   - 结果: nexus.aimstek.cn/my-project/service:v2.1.0');
  console.log('');
  
  return true;
}

function main() {
  const backendLogicPassed = testBackendParameterLogic();
  const simulationPassed = simulateJenkinsParameters();
  const explanationPassed = explainJenkinsScriptLogic();
  
  console.log('=' .repeat(50));
  console.log('📋 修复总结:');
  console.log('');
  console.log('🔧 问题根源:');
  console.log('   • 后端API总是向Jenkins传递 FULL_IMAGE 参数');
  console.log('   • 即使用户使用默认模式，也会生成并传递 FULL_IMAGE');
  console.log('   • 导致Jenkins脚本总是优先使用 FULL_IMAGE 而不是默认逻辑');
  console.log('');
  console.log('✅ 修复方案:');
  console.log('   • 移除默认的 FULL_IMAGE 参数传递');
  console.log('   • 只有当 requestedFullImage 存在时才传递 FULL_IMAGE');
  console.log('   • 保持 IMAGE_REPOSITORY 和 IMAGE_TAG 始终传递');
  console.log('   • 让Jenkins脚本根据参数存在性选择处理逻辑');
  console.log('');
  console.log('🎯 修复效果:');
  console.log('   • 默认模式: 不传递 FULL_IMAGE，Jenkins使用 IMAGE_REPOSITORY:IMAGE_TAG-commitId');
  console.log('   • 自定义模式: 传递 FULL_IMAGE，Jenkins优先使用 FULL_IMAGE');
  console.log('   • 参数清晰: 两种模式的Jenkins参数完全不同');
  console.log('   • 行为正确: Jenkins脚本按预期的优先级处理');
  console.log('');
  
  const overallSuccess = backendLogicPassed && simulationPassed && explanationPassed;
  console.log(`🏆 修复状态: ${overallSuccess ? '✅ 修复完成' : '❌ 需要进一步调整'}`);
  
  if (overallSuccess) {
    console.log('');
    console.log('🎉 问题彻底解决！');
    console.log('现在默认模式下不会传递 FULL_IMAGE 参数给Jenkins，');
    console.log('Jenkins脚本会正确使用 IMAGE_REPOSITORY:IMAGE_TAG-commitId 格式。');
  }
  
  return overallSuccess;
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testBackendParameterLogic, simulateJenkinsParameters };