/**
 * 添加Java多模块构建Dockerfile模版
 */

const javaMultiModuleTemplate = {
  id: 'maven-java-multimodule',
  name: 'Maven Java多模块构建',
  description: '基于Maven的Java多模块项目构建，支持父子模块结构，优化构建缓存',
  category: 'Java',
  base_image: 'nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21',
  workdir: '/app',
  copy_files: ['pom.xml', '*/pom.xml', '.'],
  install_commands: [
    'mvn dependency:go-offline -B',
    'mvn dependency:resolve-sources -B'
  ],
  build_commands: [
    'mvn clean compile -B',
    'mvn package -DskipTests -B'
  ],
  run_command: 'java -jar $(find . -name "*.jar" -path "*/target/*" | grep -v "original" | head -1)',
  expose_ports: [8080],
  env_vars: {
    JAVA_OPTS: '-Xms512m -Xmx2048m -XX:+UseG1GC',
    MAVEN_OPTS: '-Dmaven.repo.local=/root/.m2/repository -Xmx1024m',
    SPRING_PROFILES_ACTIVE: 'prod'
  },
  dockerfile_content: `# Maven Java多模块构建模板
# 基于Maven的Java多模块项目构建，支持父子模块结构，优化构建缓存
# 适用于Spring Boot多模块项目、微服务架构等

# 使用多阶段构建优化镜像大小
FROM nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# 设置Maven环境变量
ENV MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository -Xmx1024m"

# 第一步：复制所有pom.xml文件（包括父模块和子模块）
# 这样可以利用Docker层缓存，当pom.xml没有变化时不重新下载依赖
COPY pom.xml ./
COPY */pom.xml ./*/

# 创建空的src目录结构，避免Maven报错
RUN find . -name "pom.xml" -exec dirname {} \\; | \\
    xargs -I {} mkdir -p {}/src/main/java {}/src/main/resources {}/src/test/java

# 第二步：下载所有依赖（利用缓存层）
RUN mvn dependency:go-offline -B || true
RUN mvn dependency:resolve-sources -B || true

# 第三步：复制所有源代码
COPY . ./

# 第四步：编译和打包
# 先编译所有模块，再打包，这样可以更好地利用缓存
RUN mvn clean compile -B
RUN mvn package -DskipTests -B

# 查找并验证构建产物
RUN echo "=== 构建产物检查 ===" && \\
    find . -name "*.jar" -path "*/target/*" | grep -v "original" | head -10 && \\
    echo "=== 主要JAR文件 ===" && \\
    find . -name "*.jar" -path "*/target/*" | grep -v "original" | grep -v "sources" | grep -v "javadoc"

# 生产运行阶段 - 使用更小的JRE镜像
FROM nexus.aimstek.cn/aims-common/eclipse-temurin:21-jre

WORKDIR /app

# 设置JVM参数
ENV JAVA_OPTS="-Xms512m -Xmx2048m -XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENV SPRING_PROFILES_ACTIVE=prod

# 创建非root用户（安全最佳实践）
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 从构建阶段复制JAR文件
# 自动查找主要的可执行JAR文件（通常是Spring Boot应用）
COPY --from=builder /app/target/*.jar* ./
COPY --from=builder /app/*/target/*.jar* ./

# 创建启动脚本，自动识别主JAR文件
RUN echo '#!/bin/bash' > /app/start.sh && \\
    echo 'set -e' >> /app/start.sh && \\
    echo '' >> /app/start.sh && \\
    echo '# 查找主要的JAR文件' >> /app/start.sh && \\
    echo 'JAR_FILE=$(find /app -name "*.jar" | grep -v "original" | grep -v "sources" | grep -v "javadoc" | head -1)' >> /app/start.sh && \\
    echo '' >> /app/start.sh && \\
    echo 'if [ -z "$JAR_FILE" ]; then' >> /app/start.sh && \\
    echo '  echo "错误: 未找到可执行的JAR文件"' >> /app/start.sh && \\
    echo '  echo "可用文件:"' >> /app/start.sh && \\
    echo '  find /app -name "*.jar"' >> /app/start.sh && \\
    echo '  exit 1' >> /app/start.sh && \\
    echo 'fi' >> /app/start.sh && \\
    echo '' >> /app/start.sh && \\
    echo 'echo "启动应用: $JAR_FILE"' >> /app/start.sh && \\
    echo 'echo "JVM参数: $JAVA_OPTS"' >> /app/start.sh && \\
    echo 'exec java $JAVA_OPTS -jar "$JAR_FILE" "$@"' >> /app/start.sh && \\
    chmod +x /app/start.sh

# 设置文件权限
RUN chown -R appuser:appuser /app

# 切换到非root用户
USER appuser

# 健康检查（可根据实际应用调整）
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["/app/start.sh"]`
};

async function addJavaMultiModuleTemplate() {
  try {
    console.log('🚀 开始添加Java多模块构建模版...');
    
    const response = await fetch('http://localhost:3000/api/dockerfile-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(javaMultiModuleTemplate)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Java多模块构建模版添加成功!');
      console.log('📋 模版信息:');
      console.log(`  ID: ${result.id}`);
      console.log(`  名称: ${result.name}`);
      console.log(`  分类: ${result.category}`);
      console.log(`  基础镜像: ${result.base_image}`);
      console.log('');
      console.log('🔧 模版特性:');
      console.log('  ✅ 支持Maven多模块项目结构');
      console.log('  ✅ 优化的Docker层缓存策略');
      console.log('  ✅ 多阶段构建减小镜像大小');
      console.log('  ✅ 自动识别主JAR文件');
      console.log('  ✅ 生产环境JVM优化');
      console.log('  ✅ 安全的非root用户运行');
      console.log('  ✅ 健康检查支持');
      console.log('');
      console.log('📖 使用场景:');
      console.log('  • Spring Boot多模块项目');
      console.log('  • 微服务架构');
      console.log('  • 企业级Java应用');
      console.log('  • 复杂的Maven项目结构');
    } else {
      const error = await response.json();
      console.error('❌ 添加模版失败:', error.error);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.log('');
    console.log('💡 请确保:');
    console.log('  1. 开发服务器正在运行 (npm run dev)');
    console.log('  2. 数据库连接正常');
    console.log('  3. API端点可访问');
  }
}

// 运行添加操作
if (require.main === module) {
  addJavaMultiModuleTemplate();
}

module.exports = { addJavaMultiModuleTemplate, javaMultiModuleTemplate };