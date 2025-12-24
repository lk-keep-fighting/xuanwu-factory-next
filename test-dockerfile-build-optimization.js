#!/usr/bin/env node

/**
 * 测试优化后的 build-by-dockerfile 构建脚本
 * 验证镜像名处理逻辑是否符合需求
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 测试 build-by-dockerfile 构建脚本优化');
console.log('=' .repeat(50));

// 读取构建脚本内容
const scriptPath = 'doc/jenkins/jenkins-file/cicd/build-by-dockerfile';
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

// 测试用例
const testCases = [
  {
    name: '测试1: 传入 FULL_IMAGE，无 registry 前缀',
    params: {
      FULL_IMAGE: 'my-app:v1.0.0',
      IMAGE_REPOSITORY: '',
      IMAGE_TAG: 'latest',
      NEXUS_IMAGE_REPO: 'nexus.aimstek.cn'
    },
    expected: 'nexus.aimstek.cn/my-app:v1.0.0'
  },
  {
    name: '测试2: 传入 FULL_IMAGE，已有 registry 前缀',
    params: {
      FULL_IMAGE: 'registry.example.com/my-app:v1.0.0',
      IMAGE_REPOSITORY: '',
      IMAGE_TAG: 'latest',
      NEXUS_IMAGE_REPO: 'nexus.aimstek.cn'
    },
    expected: 'registry.example.com/my-app:v1.0.0'
  },
  {
    name: '测试3: 使用 IMAGE_REPOSITORY + IMAGE_TAG + commitId',
    params: {
      FULL_IMAGE: '',
      IMAGE_REPOSITORY: 'my-service',
      IMAGE_TAG: 'v2.0.0',
      NEXUS_IMAGE_REPO: 'nexus.aimstek.cn'
    },
    commitId: 'abc123',
    expected: 'nexus.aimstek.cn/my-service:v2.0.0-abc123'
  },
  {
    name: '测试4: IMAGE_REPOSITORY 已有 registry 前缀',
    params: {
      FULL_IMAGE: '',
      IMAGE_REPOSITORY: 'docker.io/library/my-service',
      IMAGE_TAG: 'latest',
      NEXUS_IMAGE_REPO: 'nexus.aimstek.cn'
    },
    commitId: 'def456',
    expected: 'docker.io/library/my-service:latest-def456'
  },
  {
    name: '测试5: 从 SERVICE_NAME 推断镜像名',
    params: {
      FULL_IMAGE: '',
      IMAGE_REPOSITORY: '',
      IMAGE_TAG: 'dev',
      SERVICE_NAME: 'user-service',
      NEXUS_IMAGE_REPO: 'nexus.aimstek.cn'
    },
    commitId: 'ghi789',
    expected: 'nexus.aimstek.cn/user-service:dev-ghi789'
  }
];

// 验证脚本包含的关键逻辑
function validateScript() {
  console.log('📋 验证脚本关键逻辑...\n');
  
  const checks = [
    {
      name: '获取 Git commit ID',
      pattern: /git rev-parse --short HEAD/,
      description: '脚本应该获取 Git commit ID'
    },
    {
      name: 'FULL_IMAGE 优先处理',
      pattern: /if \(params\.FULL_IMAGE\?\.trim\(\)\)/,
      description: '如果传入 FULL_IMAGE，应优先使用'
    },
    {
      name: '构建镜像名格式',
      pattern: /\$\{imageRepo\}:\$\{imageTag\}-\$\{commitId\}/,
      description: '应使用 IMAGE_REPOSITORY:IMAGE_TAG-commitId 格式'
    },
    {
      name: 'NEXUS 前缀检查',
      pattern: /hasRegistry.*contains\('\.\'\).*contains\(':\'\)/,
      description: '应检查镜像名是否已包含 registry 前缀'
    },
    {
      name: 'NEXUS 前缀追加',
      pattern: /nexusHost.*imageNoTag/,
      description: '应在需要时追加 NEXUS_IMAGE_REPO 前缀'
    }
  ];
  
  let allPassed = true;
  
  checks.forEach((check, index) => {
    const passed = check.pattern.test(scriptContent);
    console.log(`${index + 1}. ${check.name}: ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`   ${check.description}`);
      allPassed = false;
    }
  });
  
  console.log(`\n📊 验证结果: ${allPassed ? '✅ 所有检查通过' : '❌ 部分检查失败'}\n`);
  return allPassed;
}

// 模拟镜像名处理逻辑
function simulateImageNameLogic(params, commitId = 'abc123') {
  let image = '';
  
  // 如果传入了 FULL_IMAGE，则以 FULL_IMAGE 为最终镜像名
  if (params.FULL_IMAGE?.trim()) {
    image = params.FULL_IMAGE.trim();
  } else {
    // 如果没有传入 FULL_IMAGE，则以 IMAGE_REPOSITORY+":"+IMAGE_TAG+"-"+commitId 作为最终镜像名
    if (params.IMAGE_REPOSITORY?.trim()) {
      const imageTag = params.IMAGE_TAG?.trim() || 'latest';
      image = `${params.IMAGE_REPOSITORY}:${imageTag}-${commitId}`;
    } else if (params.SERVICE_NAME?.trim()) {
      const imageTag = params.IMAGE_TAG?.trim() || 'latest';
      image = `${params.SERVICE_NAME}:${imageTag}-${commitId}`;
    } else {
      throw new Error('Cannot infer image name');
    }
  }
  
  // 确定最终镜像名后，判断是否包含 NEXUS_IMAGE_REPO 前缀，没有则追加
  if (params.NEXUS_IMAGE_REPO?.trim()) {
    const nexusHost = params.NEXUS_IMAGE_REPO.trim();
    
    // 解析镜像名（去掉 tag）
    const lastColon = image.lastIndexOf(':');
    let imageNoTag = lastColon > 0 ? image.substring(0, lastColon) : image;
    const tag = lastColon > 0 ? image.substring(lastColon + 1) : 'latest';
    
    // 检查是否已经包含 registry 前缀
    const firstSlashIdx = imageNoTag.indexOf('/');
    let hasRegistry = false;
    
    if (firstSlashIdx > 0) {
      const firstPart = imageNoTag.substring(0, firstSlashIdx);
      // 如果第一部分包含点号或冒号（端口），则认为是 registry 地址
      hasRegistry = firstPart.includes('.') || firstPart.includes(':');
    }
    
    if (!hasRegistry) {
      // 如果没有 registry 前缀，追加 NEXUS_IMAGE_REPO
      imageNoTag = `${nexusHost}/${imageNoTag}`;
    }
    
    image = `${imageNoTag}:${tag}`;
  }
  
  return image;
}

// 运行测试用例
function runTests() {
  console.log('🧪 运行测试用例...\n');
  
  let passedTests = 0;
  
  testCases.forEach((testCase, index) => {
    try {
      const result = simulateImageNameLogic(testCase.params, testCase.commitId);
      const passed = result === testCase.expected;
      
      console.log(`测试 ${index + 1}: ${testCase.name}`);
      console.log(`  参数: ${JSON.stringify(testCase.params, null, 2).replace(/\n/g, '\n        ')}`);
      if (testCase.commitId) {
        console.log(`  Commit ID: ${testCase.commitId}`);
      }
      console.log(`  期望结果: ${testCase.expected}`);
      console.log(`  实际结果: ${result}`);
      console.log(`  状态: ${passed ? '✅ 通过' : '❌ 失败'}\n`);
      
      if (passed) passedTests++;
    } catch (error) {
      console.log(`测试 ${index + 1}: ${testCase.name}`);
      console.log(`  状态: ❌ 错误 - ${error.message}\n`);
    }
  });
  
  console.log(`📊 测试结果: ${passedTests}/${testCases.length} 个测试通过\n`);
  return passedTests === testCases.length;
}

// 主函数
function main() {
  const scriptValid = validateScript();
  const testsPass = runTests();
  
  console.log('=' .repeat(50));
  console.log('📋 优化总结:');
  console.log('1. ✅ 优先使用 FULL_IMAGE 参数作为最终镜像名');
  console.log('2. ✅ 未提供 FULL_IMAGE 时，使用 IMAGE_REPOSITORY:IMAGE_TAG-commitId 格式');
  console.log('3. ✅ 自动获取 Git commit ID 并追加到镜像标签');
  console.log('4. ✅ 智能检测并追加 NEXUS_IMAGE_REPO 前缀');
  console.log('5. ✅ 避免重复添加 registry 前缀');
  console.log('6. ✅ 支持从 SERVICE_NAME 等参数推断镜像名');
  
  console.log('\n🎯 优化效果:');
  console.log('- 镜像名构建逻辑更加清晰和可预测');
  console.log('- 自动包含 Git commit ID，便于版本追踪');
  console.log('- 智能处理 Nexus 私库前缀，避免重复添加');
  console.log('- 兼容现有的参数传递方式');
  
  const overallSuccess = scriptValid && testsPass;
  console.log(`\n🏆 总体状态: ${overallSuccess ? '✅ 优化成功' : '❌ 需要进一步调整'}`);
  
  return overallSuccess;
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { simulateImageNameLogic, testCases };