/**
 * 测试修正后的Spring Boot多模块参数化构建模版
 * 验证参数命名修正和功能正确性
 */

async function testCorrectedSpringBootTemplate() {
  console.log('🧪 测试修正后的Spring Boot多模块参数化构建模版...');
  
  try {
    // 获取修正后的模版
    console.log('\n📋 1. 获取修正后的模版...');
    const response = await fetch('http://localhost:3000/api/dockerfile-templates/springboot-multimodule-parameterized');
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error('获取模版失败');
    }
    
    const template = data.data;
    console.log('✅ 模版获取成功');
    console.log(`   名称: ${template.name}`);
    console.log(`   分类: ${template.category}`);
    
    // 验证参数命名修正
    console.log('\n🔧 2. 验证参数命名修正...');
    
    const dockerfile = template.dockerfile;
    
    // 检查新的参数定义
    const newParams = [
      { name: 'SPRING_PROFILES', pattern: /ARG SPRING_PROFILES=prod/ },
      { name: 'MAVEN_PROFILES', pattern: /ARG MAVEN_PROFILES=default/ },
      { name: 'TARGET_MODULE', pattern: /ARG TARGET_MODULE=app-service/ },
      { name: 'SKIP_TESTS', pattern: /ARG SKIP_TESTS=true/ }
    ];
    
    console.log('📝 构建参数检查:');
    let paramsValid = true;
    newParams.forEach(param => {
      if (param.pattern.test(dockerfile)) {
        console.log(`✅ ${param.name}: 已正确定义`);
      } else {
        console.log(`❌ ${param.name}: 定义有问题`);
        paramsValid = false;
      }
    });
    
    // 验证参数使用的正确性
    console.log('\n🎯 3. 验证参数使用正确性...');
    
    const paramUsage = [
      { 
        name: 'SPRING_PROFILES用于Spring配置', 
        pattern: /SPRING_PROFILES_ACTIVE=\$\{SPRING_PROFILES/, 
        description: 'SPRING_PROFILES参数正确用于设置Spring Boot配置文件'
      },
      { 
        name: 'MAVEN_PROFILES用于Maven构建', 
        pattern: /-P\$\{MAVEN_PROFILES\}/, 
        description: 'MAVEN_PROFILES参数正确用于Maven构建时的-P参数'
      },
      { 
        name: 'TARGET_MODULE用于模块选择', 
        pattern: /-pl \$\{TARGET_MODULE\}/, 
        description: 'TARGET_MODULE参数正确用于指定构建模块'
      },
      { 
        name: 'SKIP_TESTS用于测试控制', 
        pattern: /if \[ "\$\{SKIP_TESTS\}" = "true" \]/, 
        description: 'SKIP_TESTS参数正确用于控制是否跳过测试'
      }
    ];
    
    console.log('🔍 参数使用检查:');
    let usageValid = true;
    paramUsage.forEach(usage => {
      if (usage.pattern.test(dockerfile)) {
        console.log(`✅ ${usage.name}`);
        console.log(`   ${usage.description}`);
      } else {
        console.log(`❌ ${usage.name}`);
        console.log(`   ${usage.description}`);
        usageValid = false;
      }
    });
    
    // 验证环境变量设置
    console.log('\n🌍 4. 验证环境变量设置...');
    
    const expectedEnvVars = {
      'SPRING_PROFILES_ACTIVE': 'prod',
      'TARGET_MODULE': 'app-service',
      'SERVER_PORT': '8080'
    };
    
    console.log('环境变量检查:');
    let envVarsValid = true;
    Object.entries(expectedEnvVars).forEach(([key, expectedValue]) => {
      const actualValue = template.envVars[key];
      if (actualValue === expectedValue) {
        console.log(`✅ ${key}=${actualValue}`);
      } else {
        console.log(`❌ ${key}: 期望 "${expectedValue}", 实际 "${actualValue}"`);
        envVarsValid = false;
      }
    });
    
    // 生成修正后的使用示例
    console.log('\n💡 5. 修正后的使用示例...');
    
    const correctedExamples = [
      {
        title: '基本使用 - 明确区分Spring和Maven配置',
        examples: [
          {
            desc: '构建用户服务，生产环境Spring配置',
            cmd: 'docker build --build-arg TARGET_MODULE=user-service --build-arg SPRING_PROFILES=prod -t user-app .'
          },
          {
            desc: '构建订单服务，测试环境Spring配置',
            cmd: 'docker build --build-arg TARGET_MODULE=order-service --build-arg SPRING_PROFILES=test -t order-app .'
          }
        ]
      },
      {
        title: '高级使用 - 同时指定Maven和Spring配置',
        examples: [
          {
            desc: '开发环境：Maven和Spring都使用dev配置',
            cmd: `docker build \\
  --build-arg TARGET_MODULE=gateway-service \\
  --build-arg MAVEN_PROFILES=dev \\
  --build-arg SPRING_PROFILES=dev \\
  -t gateway-dev .`
          },
          {
            desc: '生产环境：Maven使用prod配置，Spring使用prod配置',
            cmd: `docker build \\
  --build-arg TARGET_MODULE=admin-web \\
  --build-arg MAVEN_PROFILES=prod \\
  --build-arg SPRING_PROFILES=prod \\
  --build-arg SKIP_TESTS=false \\
  -t admin-prod .`
          }
        ]
      },
      {
        title: '特殊场景 - Maven和Spring配置不同',
        examples: [
          {
            desc: 'Maven使用默认配置，Spring使用staging配置',
            cmd: 'docker build --build-arg TARGET_MODULE=api-service --build-arg SPRING_PROFILES=staging -t api-staging .'
          },
          {
            desc: 'Maven使用test配置（包含测试依赖），Spring使用prod配置',
            cmd: `docker build \\
  --build-arg TARGET_MODULE=batch-service \\
  --build-arg MAVEN_PROFILES=test \\
  --build-arg SPRING_PROFILES=prod \\
  --build-arg SKIP_TESTS=false \\
  -t batch-service .`
          }
        ]
      }
    ];
    
    correctedExamples.forEach(category => {
      console.log(`\n📚 ${category.title}:`);
      category.examples.forEach(example => {
        console.log(`\n  ${example.desc}:`);
        console.log(`  ${example.cmd}`);
      });
    });
    
    // 参数说明对比
    console.log('\n📊 6. 参数命名对比说明...');
    
    const paramComparison = [
      {
        aspect: '参数名称',
        before: 'MAVEN_PROFILES',
        after: 'SPRING_PROFILES + MAVEN_PROFILES',
        improvement: '明确区分Maven构建配置和Spring运行配置'
      },
      {
        aspect: '语义清晰度',
        before: '容易误解为Maven profile',
        after: 'SPRING_PROFILES明确表示Spring配置',
        improvement: '避免概念混淆，提高可读性'
      },
      {
        aspect: '使用灵活性',
        before: '只能统一设置',
        after: 'Maven和Spring配置可独立设置',
        improvement: '支持更复杂的构建场景'
      },
      {
        aspect: '实际用途',
        before: '实际用于Spring配置',
        after: 'SPRING_PROFILES用于Spring，MAVEN_PROFILES用于Maven',
        improvement: '名称与实际用途完全匹配'
      }
    ];
    
    console.log('🔄 改进对比:');
    paramComparison.forEach(comparison => {
      console.log(`\n  ${comparison.aspect}:`);
      console.log(`    修正前: ${comparison.before}`);
      console.log(`    修正后: ${comparison.after}`);
      console.log(`    改进点: ${comparison.improvement}`);
    });
    
    // 总结测试结果
    console.log('\n📊 测试结果总结:');
    if (paramsValid && usageValid && envVarsValid) {
      console.log('🎉 Spring Boot模版参数命名修正测试通过！');
      console.log('');
      console.log('✨ 修正成果:');
      console.log('  ✅ 参数命名更加准确和清晰');
      console.log('  ✅ Maven和Spring配置完全分离');
      console.log('  ✅ 支持更灵活的构建场景');
      console.log('  ✅ 避免了概念混淆');
      console.log('  ✅ 提高了模版的可维护性');
      console.log('');
      console.log('🚀 现在可以更准确地使用模版了！');
    } else {
      console.log('❌ 测试发现问题，需要进一步检查');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  testCorrectedSpringBootTemplate().catch(console.error);
}

module.exports = { testCorrectedSpringBootTemplate };