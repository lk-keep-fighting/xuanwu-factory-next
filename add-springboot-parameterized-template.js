/**
 * 添加Spring Boot多模块参数化构建Dockerfile模版
 * 支持通过构建参数指定要构建的模块名
 */

const springBootParameterizedTemplate = {
  id: 'springboot-multimodule-parameterized',
  name: 'Spring Boot多模块参数化构建',
  description: '支持参数化指定构建模块的Spring Boot多模块项目，统一构建流程，避免模块间差异',
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
    'mvn package -DskipTests -B -pl ${TARGET_MODULE} -am'
  ],
  run_command: 'java $JAVA_OPTS -jar /app/target/${TARGET_MODULE}.jar',
  expose_ports: [8080],
  env_vars: {
    JAVA_OPTS: '-Xms512m -Xmx2048m -XX:+UseG1GC -XX:+UseContainerSupport',
    SPRING_PROFILES_ACTIVE: 'prod',
    TARGET_MODULE: 'app-service',
    SERVER_PORT: '8080'
  },
  dockerfile_content: `# Spring Boot多模块参数化构建模版
# 支持通过构建参数指定要构建的模块名，统一构建流程
# 适用于微服务架构、多应用模块等场景

# 构建参数定义
ARG TARGET_MODULE=app-service
ARG MAVEN_PROFILES=prod
ARG SKIP_TESTS=true

# 构建阶段 - 使用Maven镜像
FROM nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21 AS builder

# 传递构建参数到构建阶段
ARG TARGET_MODULE
ARG MAVEN_PROFILES
ARG SKIP_TESTS

WORKDIR /app

# 设置Maven环境变量
ENV MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository -Xmx1024m"

# 显示构建信息
RUN echo "=== Spring Boot多模块参数化构建 ===" && \\
    echo "目标模块: \${TARGET_MODULE}" && \\
    echo "Maven配置: \${MAVEN_PROFILES}" && \\
    echo "跳过测试: \${SKIP_TESTS}" && \\
    echo "======================================="

# 第一步：复制所有pom.xml文件（父模块和子模块）
# 利用Docker层缓存，当pom.xml没有变化时不重新下载依赖
COPY pom.xml ./
COPY */pom.xml ./*/

# 创建标准的Maven目录结构，避免Maven报错
RUN find . -name "pom.xml" -exec dirname {} \\; | \\
    xargs -I {} mkdir -p {}/src/main/java {}/src/main/resources {}/src/test/java {}/src/main/webapp

# 第二步：下载所有依赖（利用缓存层）
RUN mvn dependency:go-offline -B || true
RUN mvn dependency:resolve-sources -B || true

# 第三步：复制所有源代码
COPY . ./

# 第四步：验证目标模块存在
RUN if [ ! -d "\${TARGET_MODULE}" ]; then \\
      echo "错误: 目标模块 '\${TARGET_MODULE}' 不存在"; \\
      echo "可用模块:"; \\
      find . -maxdepth 1 -type d -name "*" | grep -v "^\\.$" | grep -v "^\\./" | sort; \\
      exit 1; \\
    fi && \\
    echo "✅ 目标模块 '\${TARGET_MODULE}' 验证通过"

# 第五步：编译指定模块及其依赖
RUN mvn clean compile -B -pl \${TARGET_MODULE} -am

# 第六步：打包指定模块
RUN if [ "\${SKIP_TESTS}" = "true" ]; then \\
      mvn package -DskipTests -B -pl \${TARGET_MODULE} -am; \\
    else \\
      mvn package -B -pl \${TARGET_MODULE} -am; \\
    fi

# 第七步：查找并验证构建产物
RUN echo "=== 构建产物检查 ===" && \\
    find . -name "*.jar" -path "*\${TARGET_MODULE}/target/*" | grep -v "original" && \\
    echo "=== 主要JAR文件 ===" && \\
    TARGET_JAR=\$(find . -name "*.jar" -path "*\${TARGET_MODULE}/target/*" | grep -v "original" | grep -v "sources" | grep -v "javadoc" | head -1) && \\
    if [ -z "\$TARGET_JAR" ]; then \\
      echo "错误: 未找到模块 '\${TARGET_MODULE}' 的JAR文件"; \\
      exit 1; \\
    fi && \\
    echo "✅ 找到目标JAR: \$TARGET_JAR" && \\
    echo "JAR_PATH=\$TARGET_JAR" > /tmp/jar_info

# 第八步：标准化JAR文件位置
RUN . /tmp/jar_info && \\
    mkdir -p /app/target && \\
    cp "\$JAR_PATH" "/app/target/\${TARGET_MODULE}.jar" && \\
    echo "✅ JAR文件已标准化为: /app/target/\${TARGET_MODULE}.jar"

# 生产运行阶段 - 使用轻量级JRE镜像
FROM nexus.aimstek.cn/aims-common/eclipse-temurin:21-jre

# 传递运行时参数
ARG TARGET_MODULE
ARG MAVEN_PROFILES

WORKDIR /app

# 设置运行时环境变量
ENV JAVA_OPTS="-Xms512m -Xmx2048m -XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENV SPRING_PROFILES_ACTIVE=\${MAVEN_PROFILES:-prod}
ENV TARGET_MODULE=\${TARGET_MODULE}
ENV SERVER_PORT=8080

# 创建非root用户（安全最佳实践）
RUN groupadd -r springboot && useradd -r -g springboot springboot

# 从构建阶段复制标准化的JAR文件
COPY --from=builder /app/target/\${TARGET_MODULE}.jar /app/app.jar

# 创建统一的启动脚本
RUN echo '#!/bin/bash' > /app/start.sh && \\
    echo 'set -e' >> /app/start.sh && \\
    echo '' >> /app/start.sh && \\
    echo '# Spring Boot应用统一启动脚本' >> /app/start.sh && \\
    echo 'echo "=== Spring Boot应用启动 ==="' >> /app/start.sh && \\
    echo 'echo "模块名称: $TARGET_MODULE"' >> /app/start.sh && \\
    echo 'echo "配置文件: $SPRING_PROFILES_ACTIVE"' >> /app/start.sh && \\
    echo 'echo "服务端口: $SERVER_PORT"' >> /app/start.sh && \\
    echo 'echo "JVM参数: $JAVA_OPTS"' >> /app/start.sh && \\
    echo 'echo "JAR文件: /app/app.jar"' >> /app/start.sh && \\
    echo 'echo "=========================="' >> /app/start.sh && \\
    echo '' >> /app/start.sh && \\
    echo '# 验证JAR文件存在' >> /app/start.sh && \\
    echo 'if [ ! -f "/app/app.jar" ]; then' >> /app/start.sh && \\
    echo '  echo "错误: JAR文件不存在 /app/app.jar"' >> /app/start.sh && \\
    echo '  exit 1' >> /app/start.sh && \\
    echo 'fi' >> /app/start.sh && \\
    echo '' >> /app/start.sh && \\
    echo '# 启动Spring Boot应用' >> /app/start.sh && \\
    echo 'exec java $JAVA_OPTS \\' >> /app/start.sh && \\
    echo '  -Dserver.port=$SERVER_PORT \\' >> /app/start.sh && \\
    echo '  -Dspring.profiles.active=$SPRING_PROFILES_ACTIVE \\' >> /app/start.sh && \\
    echo '  -Dfile.encoding=UTF-8 \\' >> /app/start.sh && \\
    echo '  -Djava.security.egd=file:/dev/./urandom \\' >> /app/start.sh && \\
    echo '  -jar /app/app.jar "$@"' >> /app/start.sh && \\
    chmod +x /app/start.sh

# 创建应用配置目录
RUN mkdir -p /app/config /app/logs && \\
    chown -R springboot:springboot /app

# 切换到非root用户
USER springboot

# 健康检查 - 统一的健康检查端点
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD curl -f http://localhost:\${SERVER_PORT}/actuator/health || \\
      wget --no-verbose --tries=1 --spider http://localhost:\${SERVER_PORT}/actuator/health || \\
      exit 1

# 暴露端口（可通过环境变量动态调整）
EXPOSE \${SERVER_PORT}

# 启动应用
CMD ["/app/start.sh"]

# 构建示例:
# docker build --build-arg TARGET_MODULE=user-service --build-arg MAVEN_PROFILES=prod -t my-app .
# docker build --build-arg TARGET_MODULE=order-service --build-arg MAVEN_PROFILES=test -t my-app .
# docker build --build-arg TARGET_MODULE=gateway-service --build-arg SKIP_TESTS=false -t my-app .`
};

async function addSpringBootParameterizedTemplate() {
  try {
    console.log('🚀 开始添加Spring Boot多模块参数化构建模版...');
    
    const response = await fetch('http://localhost:3000/api/dockerfile-templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(springBootParameterizedTemplate)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Spring Boot多模块参数化构建模版添加成功!');
      console.log('');
      console.log('📋 模版信息:');
      console.log(`  ID: springboot-multimodule-parameterized`);
      console.log(`  名称: Spring Boot多模块参数化构建`);
      console.log(`  分类: Java`);
      console.log(`  基础镜像: nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21`);
      console.log('');
      console.log('🔧 核心特性:');
      console.log('  ✅ 参数化模块构建 (TARGET_MODULE)');
      console.log('  ✅ 统一构建流程，避免模块差异');
      console.log('  ✅ 多阶段构建优化镜像大小');
      console.log('  ✅ 标准化JAR文件命名和位置');
      console.log('  ✅ 统一启动脚本和配置');
      console.log('  ✅ 灵活的Maven配置文件支持');
      console.log('  ✅ 安全的非root用户运行');
      console.log('  ✅ 统一健康检查机制');
      console.log('');
      console.log('🎯 构建参数:');
      console.log('  • TARGET_MODULE: 指定要构建的模块名 (默认: app-service)');
      console.log('  • MAVEN_PROFILES: Maven配置文件 (默认: prod)');
      console.log('  • SKIP_TESTS: 是否跳过测试 (默认: true)');
      console.log('');
      console.log('💡 使用示例:');
      console.log('  docker build --build-arg TARGET_MODULE=user-service -t user-app .');
      console.log('  docker build --build-arg TARGET_MODULE=order-service -t order-app .');
      console.log('  docker build --build-arg TARGET_MODULE=gateway-service --build-arg MAVEN_PROFILES=test -t gateway-app .');
      console.log('');
      console.log('📖 适用场景:');
      console.log('  • 微服务架构中的多个服务模块');
      console.log('  • Spring Boot多应用项目');
      console.log('  • 需要统一构建流程的多模块项目');
      console.log('  • CI/CD流水线中的参数化构建');
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
  addSpringBootParameterizedTemplate();
}

module.exports = { addSpringBootParameterizedTemplate, springBootParameterizedTemplate };