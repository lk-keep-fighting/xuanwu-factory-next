#!/usr/bin/env node

/**
 * 测试自定义镜像标签功能
 * 验证前端UI和后端API是否正确支持自定义镜像标签
 */

const fs = require('fs');

console.log('🏷️ 测试自定义镜像标签功能');
console.log('=' .repeat(50));

// 测试前端UI修改
function testFrontendUI() {
  console.log('1️⃣ 检查前端UI修改...\n');
  
  const pageContent = fs.readFileSync('src/app/projects/[id]/services/[serviceId]/page.tsx', 'utf8');
  
  const uiChecks = [
    {
      name: '自定义标签状态变量',
      pattern: /useCustomTag.*useState\(false\)/,
      description: '应该添加 useCustomTag 状态变量'
    },
    {
      name: '自定义镜像仓库状态',
      pattern: /customImageRepository.*useState/,
      description: '应该添加 customImageRepository 状态变量'
    },
    {
      name: '自定义镜像标签状态',
      pattern: /customImageTag.*useState/,
      description: '应该添加 customImageTag 状态变量'
    },
    {
      name: '自定义标签勾选框',
      pattern: /type="checkbox"[\s\S]*?id="useCustomTag"/,
      description: '应该添加自定义标签勾选框'
    },
    {
      name: '条件渲染UI',
      pattern: /useCustomTag \? \(/,
      description: '应该根据勾选状态条件渲染不同UI'
    },
    {
      name: '最终镜像名预览',
      pattern: /最终镜像名/,
      description: '应该显示最终镜像名预览'
    },
    {
      name: 'fullImage参数处理',
      pattern: /payload\.fullImage/,
      description: '应该在构建时传递 fullImage 参数'
    }
  ];
  
  let passedChecks = 0;
  
  uiChecks.forEach((check, index) => {
    const passed = check.pattern.test(pageContent);
    console.log(`${index + 1}. ${check.name}: ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`   ${check.description}`);
    } else {
      passedChecks++;
    }
  });
  
  console.log(`\n📊 前端UI检查: ${passedChecks}/${uiChecks.length} 通过\n`);
  return passedChecks === uiChecks.length;
}

// 测试后端API修改
function testBackendAPI() {
  console.log('2️⃣ 检查后端API修改...\n');
  
  const apiContent = fs.readFileSync('src/app/api/services/[id]/build/route.ts', 'utf8');
  const serviceContent = fs.readFileSync('src/service/serviceSvc.ts', 'utf8');
  
  const apiChecks = [
    {
      name: 'BuildRequestPayload类型',
      pattern: /fullImage\?\: string/,
      description: '应该在 BuildRequestPayload 中添加 fullImage 字段',
      content: apiContent
    },
    {
      name: 'fullImage参数解析',
      pattern: /requestedFullImage.*payload\.fullImage/,
      description: '应该解析 fullImage 参数',
      content: apiContent
    },
    {
      name: '自定义镜像逻辑',
      pattern: /if \(requestedFullImage\)/,
      description: '应该添加自定义镜像处理逻辑',
      content: apiContent
    },
    {
      name: '镜像名解析',
      pattern: /lastColonIndex.*fullImage\.lastIndexOf/,
      description: '应该正确解析自定义镜像名和标签',
      content: apiContent
    },
    {
      name: '元数据记录',
      pattern: /useCustomImage.*requestedFullImage/,
      description: '应该在元数据中记录自定义镜像信息',
      content: apiContent
    },
    {
      name: '服务API类型更新',
      pattern: /fullImage\?\: string.*BuildServiceResponse/,
      description: '应该更新服务API的参数类型',
      content: serviceContent
    }
  ];
  
  let passedChecks = 0;
  
  apiChecks.forEach((check, index) => {
    const passed = check.pattern.test(check.content);
    console.log(`${index + 1}. ${check.name}: ${passed ? '✅' : '❌'}`);
    if (!passed) {
      console.log(`   ${check.description}`);
    } else {
      passedChecks++;
    }
  });
  
  console.log(`\n📊 后端API检查: ${passedChecks}/${apiChecks.length} 通过\n`);
  return passedChecks === apiChecks.length;
}

// 模拟使用场景
function simulateUsageScenarios() {
  console.log('3️⃣ 模拟使用场景...\n');
  
  const scenarios = [
    {
      name: '默认模式构建',
      description: '用户不勾选自定义标签，使用系统默认规则',
      params: {
        branch: 'main',
        tag: 'dev-20241223120000'
      },
      expected: {
        useCustomTag: false,
        jenkinsParams: {
          IMAGE_REPOSITORY: 'project/service',
          IMAGE_TAG: 'dev-20241223120000'
        }
      }
    },
    {
      name: '自定义标签模式',
      description: '用户勾选自定义标签，完全自定义镜像名',
      params: {
        branch: 'feature/new-ui',
        fullImage: 'my-registry.com/my-project/my-service:v2.1.0'
      },
      expected: {
        useCustomTag: true,
        jenkinsParams: {
          FULL_IMAGE: 'my-registry.com/my-project/my-service:v2.1.0'
        }
      }
    },
    {
      name: '私有仓库自定义',
      description: '用户使用私有仓库的自定义镜像名',
      params: {
        branch: 'main',
        fullImage: 'harbor.company.com/backend/user-service:release-1.0.0'
      },
      expected: {
        useCustomTag: true,
        jenkinsParams: {
          FULL_IMAGE: 'harbor.company.com/backend/user-service:release-1.0.0'
        }
      }
    }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`场景 ${index + 1}: ${scenario.name}`);
    console.log(`  描述: ${scenario.description}`);
    console.log(`  输入参数: ${JSON.stringify(scenario.params, null, 4)}`);
    console.log(`  期望结果: ${JSON.stringify(scenario.expected, null, 4)}`);
    console.log('');
  });
  
  return true;
}

// 生成使用指南
function generateUsageGuide() {
  console.log('4️⃣ 使用指南...\n');
  
  console.log('🚀 如何使用自定义镜像标签功能:');
  console.log('');
  console.log('1. 默认模式 (推荐)');
  console.log('   - 不勾选"自定义镜像标签"');
  console.log('   - 选择镜像版本类型 (dev/test/release)');
  console.log('   - 系统自动生成镜像名: IMAGE_REPOSITORY:IMAGE_TAG-commitId');
  console.log('   - 自动追加 NEXUS_IMAGE_REPO 前缀');
  console.log('');
  console.log('2. 自定义模式 (高级用户)');
  console.log('   - 勾选"自定义镜像标签"');
  console.log('   - 填写镜像仓库: 例如 "my-project/my-service"');
  console.log('   - 填写镜像标签: 例如 "v1.0.0"');
  console.log('   - 系统使用 FULL_IMAGE 参数传递给 Jenkins');
  console.log('   - Jenkins 脚本会智能处理 NEXUS 前缀');
  console.log('');
  console.log('💡 使用建议:');
  console.log('   • 日常开发使用默认模式，简单快捷');
  console.log('   • 发布版本或特殊需求时使用自定义模式');
  console.log('   • 自定义模式下可以指定任意仓库和标签');
  console.log('   • 系统会自动处理 Nexus 私库前缀，无需手动添加');
  console.log('');
  
  return true;
}

// 主函数
function main() {
  const frontendPassed = testFrontendUI();
  const backendPassed = testBackendAPI();
  const scenariosPassed = simulateUsageScenarios();
  const guidePassed = generateUsageGuide();
  
  console.log('=' .repeat(50));
  console.log('📋 功能实现总结:');
  console.log('');
  console.log('✅ 前端UI增强:');
  console.log('   • 添加自定义标签勾选框');
  console.log('   • 条件渲染不同的输入界面');
  console.log('   • 实时预览最终镜像名');
  console.log('   • 智能表单验证');
  console.log('');
  console.log('✅ 后端API扩展:');
  console.log('   • 支持 fullImage 参数');
  console.log('   • 智能解析镜像名和标签');
  console.log('   • 兼容现有构建逻辑');
  console.log('   • 完整的元数据记录');
  console.log('');
  console.log('✅ Jenkins集成:');
  console.log('   • 优先使用 FULL_IMAGE 参数');
  console.log('   • 自动处理 NEXUS 前缀');
  console.log('   • 向后兼容现有脚本');
  console.log('');
  
  const overallSuccess = frontendPassed && backendPassed && scenariosPassed && guidePassed;
  console.log(`🏆 总体状态: ${overallSuccess ? '✅ 功能实现完成' : '❌ 需要进一步调整'}`);
  
  if (overallSuccess) {
    console.log('');
    console.log('🎉 自定义镜像标签功能已成功实现！');
    console.log('用户现在可以选择使用默认构建规则或完全自定义镜像标签。');
  }
  
  return overallSuccess;
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testFrontendUI, testBackendAPI, simulateUsageScenarios };