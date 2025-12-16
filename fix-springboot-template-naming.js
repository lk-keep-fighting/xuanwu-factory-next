/**
 * 修正Spring Boot多模块参数化构建模版的命名问题
 * 将MAVEN_PROFILES改为SPRING_PROFILES，更准确地反映其用途
 */

const correctedSpringBootTemplate = {
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
ARG SPRING_PROFILES=prod
ARG MAVEN_PROFILES=default
ARG SKIP_TESTS=true

# 构建阶段 - 使用Maven镜像
FROM nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21 AS builder

# 传递构建参数到构建阶段
ARG TARGET_MODULE
ARG SPRING_PROFILES
ARG MAVEN_PROFILES
ARG SKIP_TESTS

WORKDIR /app

# 设置Maven环境变量
ENV MAVEN_OPTS="-Dmaven.repo.local=/root/.m2/repository -Xmx1024m"

# 显示构建信息
RUN echo "=== Spring Boot多模块参数化构建 ===" && \\
    echo "目标模块: \${TARGET_MODULE}" && \\
    echo "Spring配置: \${SPRING_PROFILES}" && \\
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
RUN if [ "\${MAVEN_PROFILES}" != "default" ]; then \\
      mvn dependency:go-offline -B -P\${MAVEN_PROFILES} || true; \\
    else \\
      mvn dependency:go-offline -B || true; \\
    fi
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
RUN if [ "\${MAVEN_PROFILES}" != "default" ]; then \\
      mvn clean compile -B -pl \${TARGET_MODULE} -am -P\${MAVEN_PROFILES}; \\
    else \\
      mvn clean compile -B -pl \${TARGET_MODULE} -am; \\
    fi

# 第六步：打包指定模块
RUN BUILD_CMD="mvn package -B -pl \${TARGET_MODULE} -am"; \\
    if [ "\${SKIP_TESTS}" = "true" ]; then \\
      BUILD_CMD="\$BUILD_CMD -DskipTests"; \\
    fi; \\
    if [ "\${MAVEN_PROFILES}" != "default" ]; then \\
      BUILD_CMD="\$BUILD_CMD -P\${MAVEN_PROFILES}"; \\
    fi; \\
    echo "执行构建命令: \$BUILD_CMD"; \\
    eval \$BUILD_CMD

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
ARG SPRING_PROFILES

WORKDIR /app

# 设置运行时环境变量
ENV JAVA_OPTS="-Xms512m -Xmx2048m -XX:+UseG1GC -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENV SPRING_PROFILES_ACTIVE=\${SPRING_PROFILES:-prod}
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
    echo 'echo "Spring配置: $SPRING_PROFILES_ACTIVE"' >> /app/start.sh && \\
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
# 基本使用 - 只指定模块和Spring配置
# docker build --build-arg TARGET_MODULE=user-service --build-arg SPRING_PROFILES=prod -t user-app .
# docker build --build-arg TARGET_MODULE=order-service --build-arg SPRING_PROFILES=test -t order-app .
#
# 高级使用 - 同时指定Maven和Spring配置
# docker build --build-arg TARGET_MODULE=gateway-service --build-arg MAVEN_PROFILES=dev --build-arg SPRING_PROFILES=dev -t gateway-app .
# docker build --build-arg TARGET_MODULE=admin-web --build-arg MAVEN_PROFILES=prod --build-arg SPRING_PROFILES=prod --build-arg SKIP_TESTS=false -t admin-app .`
};

async function fixSpringBootTemplateNaming() {
  try {
    console.log('🔧 开始修正Spring Boot模版参数命名...');
    
    const response = await fetch('http://localhost:3000/api/dockerfile-templates/springboot-multimodule-parameterized', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(correctedSpringBootTemplate)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Spring Boot模版参数命名修正成功!');
      console.log('');
      console.log('🔄 修正内容:');
      console.log('  ❌ 修正前: MAVEN_PROFILES (容易误解为Maven profile)');
      console.log('  ✅ 修正后: SPRING_PROFILES (明确表示Spring Boot profile)');
      console.log('');
      console.log('📋 现在的构建参数:');
      console.log('  • TARGET_MODULE: 指定要构建的模块名');
      console.log('  • SPRING_PROFILES: Spring Boot配置文件 (dev/test/staging/prod)');
      console.log('  • MAVEN_PROFILES: Maven配置文件 (可选，默认为default)');
      console.log('  • SKIP_TESTS: 是否跳过测试 (true/false)');
      console.log('');
      console.log('💡 使用示例:');
      console.log('  # 基本使用 - 指定模块和Spring配置');
      console.log('  docker build --build-arg TARGET_MODULE=user-service --build-arg SPRING_PROFILES=prod -t user-app .');
      console.log('');
      console.log('  # 高级使用 - 同时指定Maven和Spring配置');
      console.log('  docker build \\');
      console.log('    --build-arg TARGET_MODULE=gateway-service \\');
      console.log('    --build-arg MAVEN_PROFILES=dev \\');
      console.log('    --build-arg SPRING_PROFILES=dev \\');
      console.log('    -t gateway-app .');
      console.log('');
      console.log('🎯 参数用途说明:');
      console.log('  • SPRING_PROFILES → 设置 SPRING_PROFILES_ACTIVE 环境变量');
      console.log('  • MAVEN_PROFILES → 用于 Maven 构建时的 -P 参数');
      console.log('  • 两者可以独立设置，满足不同场景需求');
    } else {
      const error = await response.json();
      console.error('❌ 修正失败:', error.error);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.log('');
    console.log('💡 请确保:');
    console.log('  1. 开发服务器正在运行 (npm run dev)');
    console.log('  2. 数据库连接正常');
    console.log('  3. 模版ID存在');
  }
}

// 运行修正操作
if (require.main === module) {
  fixSpringBootTemplateNaming();
}

module.exports = { fixSpringBootTemplateNaming, correctedSpringBootTemplate };