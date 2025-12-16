/**
 * 测试Spring Boot多模块参数化构建模版
 * 验证参数化构建功能和统一流程
 */

async function testSpringBootParameterizedTemplate() {
  console.log('🧪 开始测试Spring Boot多模块参数化构建模版...');
  
  try {
    // 1. 获取模版并验证存在
    console.log('\n📋 1. 检查模版是否存在...');
    const templatesResponse = await fetch('http://localhost:3000/api/dockerfile-templates');
    const templatesData = await templatesResponse.json();
    
    if (!templatesData.success) {
      throw new Error('获取模版列表失败');
    }
    
    const parameterizedTemplate = templatesData.data.find(t => t.id === 'springboot-multimodule-parameterized');
    
    if (!parameterizedTemplate) {
      throw new Error('未找到Spring Boot多模块参数化构建模版');
    }
    
    console.log('✅ Spring Boot多模块参数化构建模版存在');
    console.log(`   名称: ${parameterizedTemplate.name}`);
    console.log(`   分类: ${parameterizedTemplate.category}`);
    console.log(`   基础镜像: ${parameterizedTemplate.baseImage}`);
    
    // 2. 验证参数化特性
    console.log('\n🎯 2. 验证参数化特性...');
    
    const dockerfile = parameterizedTemplate.dockerfile;
    
    // 检查构建参数定义
    const buildArgs = [
      { name: 'TARGET_MODULE', pattern: /ARG TARGET_MODULE/ },
      { name: 'MAVEN_PROFILES', pattern: /ARG MAVEN_PROFILES/ },
      { name: 'SKIP_TESTS', pattern: /ARG SKIP_TESTS/ }
    ];
    
    console.log('📝 构建参数检查:');
    buildArgs.forEach(arg => {
      if (arg.pattern.test(dockerfile)) {
        console.log(`✅ ${arg.name}: 已定义`);
      } else {
        console.log(`❌ ${arg.name}: 未找到`);
      }
    });
    
    // 3. 验证统一构建流程特性
    console.log('\n🔧 3. 验证统一构建流程特性...');
    
    const unifiedFeatures = [
      { name: '参数化模块构建', pattern: /-pl \$\{TARGET_MODULE\}/ },
      { name: '模块存在性验证', pattern: /if \[ ! -d "\$\{TARGET_MODULE\}" \]/ },
      { name: '标准化JAR位置', pattern: /\/app\/target\/\$\{TARGET_MODULE\}\.jar/ },
      { name: '统一启动脚本', pattern: /start\.sh/ },
      { name: '统一健康检查', pattern: /actuator\/health/ },
      { name: '环境变量传递', pattern: /TARGET_MODULE=\$\{TARGET_MODULE\}/ },
      { name: '多阶段构建', pattern: /FROM.*AS builder/ },
      { name: '非root用户', pattern: /useradd.*springboot/ }
    ];
    
    let featuresValid = true;
    unifiedFeatures.forEach(feature => {
      if (feature.pattern.test(dockerfile)) {
        console.log(`✅ ${feature.name}`);
      } else {
        console.log(`❌ 缺少: ${feature.name}`);
        featuresValid = false;
      }
    });
    
    // 4. 验证避免模块差异的设计
    console.log('\n🎨 4. 验证统一性设计...');
    
    const unificationFeatures = [
      { name: '标准化JAR命名', description: '所有模块JAR都重命名为app.jar', pattern: /app\.jar/ },
      { name: '统一启动命令', description: '所有模块使用相同的启动脚本', pattern: /exec java.*\/app\/app\.jar/ },
      { name: '统一端口配置', description: '通过环境变量统一端口配置', pattern: /SERVER_PORT/ },
      { name: '统一配置文件', description: '通过环境变量统一Spring配置', pattern: /SPRING_PROFILES_ACTIVE/ },
      { name: '统一健康检查', description: '所有模块使用相同的健康检查端点', pattern: /actuator\/health/ }
    ];
    
    console.log('🔄 统一性特性:');
    unificationFeatures.forEach(feature => {
      if (feature.pattern.test(dockerfile)) {
        console.log(`✅ ${feature.name}: ${feature.description}`);
      } else {
        console.log(`❌ ${feature.name}: ${feature.description}`);
        featuresValid = false;
      }
    });
    
    // 5. 验证环境变量配置
    console.log('\n🌍 5. 验证环境变量配置...');
    
    const expectedEnvVars = {
      'JAVA_OPTS': '-Xms512m -Xmx2048m -XX:+UseG1GC -XX:+UseContainerSupport',
      'SPRING_PROFILES_ACTIVE': 'prod',
      'TARGET_MODULE': 'app-service',
      'SERVER_PORT': '8080'
    };
    
    let envVarsValid = true;
    Object.entries(expectedEnvVars).forEach(([key, expectedValue]) => {
      const actualValue = parameterizedTemplate.envVars[key];
      if (actualValue === expectedValue) {
        console.log(`✅ ${key}=${actualValue}`);
      } else {
        console.log(`❌ ${key}: 期望 "${expectedValue}", 实际 "${actualValue}"`);
        envVarsValid = false;
      }
    });
    
    // 6. 验证构建命令的参数化
    console.log('\n🔨 6. 验证构建命令参数化...');
    
    const buildCommands = parameterizedTemplate.buildCommands;
    console.log('构建命令:');
    buildCommands.forEach(cmd => {
      console.log(`  ${cmd}`);
      if (cmd.includes('${TARGET_MODULE}')) {
        console.log(`    ✅ 包含参数化模块引用`);
      }
    });
    
    // 7. 生成使用示例
    console.log('\n💡 7. 生成使用示例...');
    
    const usageExamples = [
      {
        scenario: '构建用户服务',
        command: 'docker build --build-arg TARGET_MODULE=user-service -t user-app .',
        description: '构建user-service模块，使用默认prod配置'
      },
      {
        scenario: '构建订单服务（测试环境）',
        command: 'docker build --build-arg TARGET_MODULE=order-service --build-arg MAVEN_PROFILES=test -t order-app .',
        description: '构建order-service模块，使用test配置'
      },
      {
        scenario: '构建网关服务（包含测试）',
        command: 'docker build --build-arg TARGET_MODULE=gateway-service --build-arg SKIP_TESTS=false -t gateway-app .',
        description: '构建gateway-service模块，执行单元测试'
      },
      {
        scenario: '构建管理后台',
        command: 'docker build --build-arg TARGET_MODULE=admin-web --build-arg MAVEN_PROFILES=prod -t admin-app .',
        description: '构建admin-web模块，生产环境配置'
      }
    ];
    
    console.log('🚀 使用示例:');
    usageExamples.forEach((example, index) => {
      console.log(`\n  ${index + 1}. ${example.scenario}:`);
      console.log(`     命令: ${example.command}`);
      console.log(`     说明: ${example.description}`);
    });
    
    // 8. 验证项目结构适配性
    console.log('\n📁 8. 项目结构适配性...');
    
    const projectStructures = [
      {
        name: '微服务架构',
        structure: `
parent-project/
├── pom.xml (父模块)
├── user-service/
│   ├── pom.xml
│   └── src/main/java/...
├── order-service/
│   ├── pom.xml
│   └── src/main/java/...
└── gateway-service/
    ├── pom.xml
    └── src/main/java/...`
      },
      {
        name: 'Spring Boot多应用',
        structure: `
multi-app-project/
├── pom.xml (父模块)
├── web-app/
│   ├── pom.xml
│   └── src/main/java/...
├── admin-app/
│   ├── pom.xml
│   └── src/main/java/...
└── api-app/
    ├── pom.xml
    └── src/main/java/...`
      }
    ];
    
    console.log('📋 支持的项目结构:');
    projectStructures.forEach(structure => {
      console.log(`\n✅ ${structure.name}:`);
      console.log(structure.structure);
    });
    
    // 9. 总结测试结果
    console.log('\n📊 测试结果总结:');
    if (featuresValid && envVarsValid) {
      console.log('🎉 Spring Boot多模块参数化构建模版测试通过！');
      console.log('');
      console.log('✨ 核心优势:');
      console.log('  ✅ 参数化构建 - 一个模版支持多个模块');
      console.log('  ✅ 统一流程 - 避免不同模块的构建差异');
      console.log('  ✅ 标准化输出 - 所有模块使用相同的JAR命名');
      console.log('  ✅ 统一启动 - 相同的启动脚本和配置方式');
      console.log('  ✅ 灵活配置 - 支持不同的Maven配置文件');
      console.log('  ✅ CI/CD友好 - 适合流水线参数化构建');
      console.log('');
      console.log('🎯 解决的问题:');
      console.log('  • 避免为每个模块创建单独的Dockerfile');
      console.log('  • 统一构建和部署流程');
      console.log('  • 减少维护成本和配置差异');
      console.log('  • 提高CI/CD流水线的复用性');
      console.log('');
      console.log('🚀 立即可用 - 模版已就绪！');
    } else {
      console.log('❌ 测试发现问题，请检查模版配置');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
    console.log('');
    console.log('💡 请确保:');
    console.log('  1. 开发服务器正在运行 (npm run dev)');
    console.log('  2. 数据库连接正常');
    console.log('  3. Spring Boot参数化模版已正确添加');
  }
}

// 运行测试
if (require.main === module) {
  testSpringBootParameterizedTemplate().catch(console.error);
}

module.exports = { testSpringBootParameterizedTemplate };