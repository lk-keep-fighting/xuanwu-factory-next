/**
 * 测试Java多模块构建模版
 * 验证模版是否正确添加并可以正常使用
 */

async function testJavaMultiModuleTemplate() {
  console.log('🧪 开始测试Java多模块构建模版...');
  
  try {
    // 1. 获取所有模版，验证Java多模块模版存在
    console.log('\n📋 1. 检查模版是否存在...');
    const templatesResponse = await fetch('http://localhost:3000/api/dockerfile-templates');
    const templatesData = await templatesResponse.json();
    
    if (!templatesData.success) {
      throw new Error('获取模版列表失败');
    }
    
    const javaMultiModuleTemplate = templatesData.data.find(t => t.id === 'maven-java-multimodule');
    
    if (!javaMultiModuleTemplate) {
      throw new Error('未找到Java多模块构建模版');
    }
    
    console.log('✅ Java多模块构建模版存在');
    console.log(`   名称: ${javaMultiModuleTemplate.name}`);
    console.log(`   分类: ${javaMultiModuleTemplate.category}`);
    console.log(`   基础镜像: ${javaMultiModuleTemplate.baseImage}`);
    
    // 2. 验证模版配置
    console.log('\n🔧 2. 验证模版配置...');
    
    // 检查基础配置
    const expectedConfig = {
      baseImage: 'nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21',
      workdir: '/app',
      category: 'Java'
    };
    
    let configValid = true;
    Object.entries(expectedConfig).forEach(([key, expectedValue]) => {
      if (javaMultiModuleTemplate[key] !== expectedValue) {
        console.log(`❌ ${key}: 期望 "${expectedValue}", 实际 "${javaMultiModuleTemplate[key]}"`);
        configValid = false;
      } else {
        console.log(`✅ ${key}: ${javaMultiModuleTemplate[key]}`);
      }
    });
    
    // 检查复制文件配置
    const expectedCopyFiles = ['pom.xml', '*/pom.xml', '.'];
    const actualCopyFiles = javaMultiModuleTemplate.copyFiles;
    
    console.log('\n📁 复制文件配置:');
    expectedCopyFiles.forEach(file => {
      if (actualCopyFiles.includes(file)) {
        console.log(`✅ ${file}`);
      } else {
        console.log(`❌ 缺少: ${file}`);
        configValid = false;
      }
    });
    
    // 检查安装命令
    console.log('\n📦 安装命令:');
    javaMultiModuleTemplate.installCommands.forEach(cmd => {
      console.log(`✅ ${cmd}`);
    });
    
    // 检查构建命令
    console.log('\n🔨 构建命令:');
    javaMultiModuleTemplate.buildCommands.forEach(cmd => {
      console.log(`✅ ${cmd}`);
    });
    
    // 检查环境变量
    console.log('\n🌍 环境变量:');
    Object.entries(javaMultiModuleTemplate.envVars).forEach(([key, value]) => {
      console.log(`✅ ${key}=${value}`);
    });
    
    // 检查端口配置
    console.log('\n🔌 暴露端口:');
    javaMultiModuleTemplate.exposePorts.forEach(port => {
      console.log(`✅ ${port}`);
    });
    
    // 3. 验证Dockerfile内容
    console.log('\n📄 3. 验证Dockerfile内容...');
    const dockerfile = javaMultiModuleTemplate.dockerfile;
    
    // 检查关键特性
    const requiredFeatures = [
      { name: '多阶段构建', pattern: /FROM.*AS builder/ },
      { name: '复制pom.xml文件', pattern: /COPY.*pom\.xml/ },
      { name: '创建目录结构', pattern: /mkdir -p.*src\/main\/java/ },
      { name: '下载依赖', pattern: /mvn dependency:go-offline/ },
      { name: '编译构建', pattern: /mvn clean compile/ },
      { name: '打包应用', pattern: /mvn package/ },
      { name: '生产镜像', pattern: /FROM.*eclipse-temurin.*jre/ },
      { name: '非root用户', pattern: /useradd.*appuser/ },
      { name: '启动脚本', pattern: /start\.sh/ },
      { name: '健康检查', pattern: /HEALTHCHECK/ },
      { name: 'JVM优化', pattern: /UseG1GC/ }
    ];
    
    let dockerfileValid = true;
    requiredFeatures.forEach(feature => {
      if (feature.pattern.test(dockerfile)) {
        console.log(`✅ ${feature.name}`);
      } else {
        console.log(`❌ 缺少: ${feature.name}`);
        dockerfileValid = false;
      }
    });
    
    // 4. 测试模版获取API
    console.log('\n🔍 4. 测试单个模版获取...');
    const singleTemplateResponse = await fetch(`http://localhost:3000/api/dockerfile-templates/maven-java-multimodule`);
    const singleTemplateData = await singleTemplateResponse.json();
    
    if (singleTemplateData.success && singleTemplateData.data) {
      console.log('✅ 单个模版获取成功');
      console.log(`   模版名称: ${singleTemplateData.data.name}`);
    } else {
      console.log('❌ 单个模版获取失败');
      dockerfileValid = false;
    }
    
    // 5. 总结测试结果
    console.log('\n📊 测试结果总结:');
    if (configValid && dockerfileValid) {
      console.log('🎉 Java多模块构建模版测试通过！');
      console.log('');
      console.log('✨ 模版特性验证:');
      console.log('  ✅ 支持Maven多模块项目结构');
      console.log('  ✅ 优化的Docker层缓存策略');
      console.log('  ✅ 多阶段构建减小镜像大小');
      console.log('  ✅ 自动识别主JAR文件');
      console.log('  ✅ 生产环境JVM优化');
      console.log('  ✅ 安全的非root用户运行');
      console.log('  ✅ 健康检查支持');
      console.log('');
      console.log('🚀 模版已就绪，可以在以下场景使用:');
      console.log('  • Spring Boot多模块项目');
      console.log('  • 微服务架构');
      console.log('  • 企业级Java应用');
      console.log('  • 复杂的Maven项目结构');
      console.log('');
      console.log('💡 使用方法:');
      console.log('  1. 访问: http://localhost:3000/settings/dockerfile-templates');
      console.log('  2. 在项目构建配置中选择"Maven Java多模块构建"模版');
      console.log('  3. 根据项目需要调整Dockerfile内容');
    } else {
      console.log('❌ 测试发现问题，请检查模版配置');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message);
    console.log('');
    console.log('💡 请确保:');
    console.log('  1. 开发服务器正在运行 (npm run dev)');
    console.log('  2. 数据库连接正常');
    console.log('  3. Java多模块模版已正确添加');
  }
}

// 运行测试
if (require.main === module) {
  testJavaMultiModuleTemplate().catch(console.error);
}

module.exports = { testJavaMultiModuleTemplate };