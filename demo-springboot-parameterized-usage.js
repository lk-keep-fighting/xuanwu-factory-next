/**
 * Spring Boot多模块参数化构建模版使用演示
 * 展示如何使用参数化模版构建不同的模块
 */

console.log('🚀 Spring Boot多模块参数化构建模版使用演示');
console.log('');

console.log('📋 模版信息:');
console.log('  ID: springboot-multimodule-parameterized');
console.log('  名称: Spring Boot多模块参数化构建');
console.log('  分类: Java');
console.log('');

console.log('🎯 核心优势:');
console.log('  ✅ 一个模版支持多个模块构建');
console.log('  ✅ 统一构建流程，避免模块差异');
console.log('  ✅ 参数化配置，灵活选择模块');
console.log('  ✅ 标准化输出，统一启动方式');
console.log('  ✅ CI/CD友好，支持流水线集成');
console.log('');

console.log('🔧 构建参数:');
console.log('  • TARGET_MODULE: 指定要构建的模块名');
console.log('  • MAVEN_PROFILES: Maven配置文件 (dev/test/staging/prod)');
console.log('  • SKIP_TESTS: 是否跳过测试 (true/false)');
console.log('');

console.log('💡 使用示例:');
console.log('');

// 基本使用示例
console.log('1️⃣ 基本使用 - 构建不同模块:');
const basicExamples = [
  'docker build --build-arg TARGET_MODULE=user-service -t user-app .',
  'docker build --build-arg TARGET_MODULE=order-service -t order-app .',
  'docker build --build-arg TARGET_MODULE=gateway-service -t gateway-app .',
  'docker build --build-arg TARGET_MODULE=admin-web -t admin-app .'
];

basicExamples.forEach((cmd, index) => {
  console.log(`   ${cmd}`);
});
console.log('');

// 高级配置示例
console.log('2️⃣ 高级配置 - 多参数组合:');
const advancedExamples = [
  {
    desc: '测试环境构建',
    cmd: 'docker build --build-arg TARGET_MODULE=user-service --build-arg MAVEN_PROFILES=test -t user-app-test .'
  },
  {
    desc: '包含单元测试',
    cmd: 'docker build --build-arg TARGET_MODULE=order-service --build-arg SKIP_TESTS=false -t order-app .'
  },
  {
    desc: '预发布环境',
    cmd: 'docker build --build-arg TARGET_MODULE=gateway-service --build-arg MAVEN_PROFILES=staging -t gateway-staging .'
  }
];

advancedExamples.forEach(example => {
  console.log(`   # ${example.desc}`);
  console.log(`   ${example.cmd}`);
  console.log('');
});

// 运行示例
console.log('3️⃣ 运行容器:');
const runExamples = [
  {
    desc: '默认配置运行',
    cmd: 'docker run -p 8080:8080 user-app'
  },
  {
    desc: '自定义端口',
    cmd: 'docker run -p 9090:9090 -e SERVER_PORT=9090 order-app'
  },
  {
    desc: '开发环境配置',
    cmd: 'docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=dev gateway-app'
  },
  {
    desc: '自定义JVM参数',
    cmd: 'docker run -p 8080:8080 -e JAVA_OPTS="-Xms1g -Xmx4g" admin-app'
  }
];

runExamples.forEach(example => {
  console.log(`   # ${example.desc}`);
  console.log(`   ${example.cmd}`);
  console.log('');
});

console.log('📁 适用项目结构:');
console.log('');
console.log('🏗️ 微服务架构:');
console.log(`
   microservices-project/
   ├── pom.xml (父模块)
   ├── user-service/
   │   ├── pom.xml
   │   └── src/main/java/...
   ├── order-service/
   │   ├── pom.xml
   │   └── src/main/java/...
   └── gateway-service/
       ├── pom.xml
       └── src/main/java/...
`);

console.log('🏢 多应用项目:');
console.log(`
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
       └── src/main/java/...
`);

console.log('🔄 CI/CD集成示例:');
console.log('');
console.log('Jenkins Pipeline:');
console.log(`
   pipeline {
       agent any
       parameters {
           choice(
               name: 'TARGET_MODULE',
               choices: ['user-service', 'order-service', 'gateway-service'],
               description: '选择要构建的模块'
           )
       }
       stages {
           stage('Build') {
               steps {
                   sh """
                       docker build \\
                         --build-arg TARGET_MODULE=\${params.TARGET_MODULE} \\
                         --build-arg MAVEN_PROFILES=prod \\
                         -t \${params.TARGET_MODULE}:\${BUILD_NUMBER} .
                   """
               }
           }
       }
   }
`);

console.log('🎉 模版已就绪，立即可用！');
console.log('');
console.log('📖 更多信息:');
console.log('  • 访问: http://localhost:3000/settings/dockerfile-templates');
console.log('  • 查看完整文档: SPRINGBOOT_PARAMETERIZED_TEMPLATE_COMPLETE.md');
console.log('  • 在项目构建配置中选择此模版使用');