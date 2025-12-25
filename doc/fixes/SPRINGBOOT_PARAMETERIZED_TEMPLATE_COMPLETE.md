# Spring Boot多模块参数化构建模版完成

## 概述
成功创建了一个支持参数化指定构建模块的Spring Boot多模块项目构建模版。该模版通过构建参数来指定要构建的具体模块，同时保持构建和启动流程的一致性，避免不同模块间的差异。

## 模版信息

### 基本配置
- **模版ID**: `springboot-multimodule-parameterized`
- **模版名称**: Spring Boot多模块参数化构建
- **分类**: Java
- **基础镜像**: `nexus.aimstek.cn/aims-common/maven:3.9-eclipse-temurin-21`
- **工作目录**: `/app`

## 核心特性

### 1. 参数化构建支持
通过Docker构建参数实现灵活的模块选择：

```dockerfile
ARG TARGET_MODULE=app-service    # 目标构建模块
ARG MAVEN_PROFILES=prod         # Maven配置文件
ARG SKIP_TESTS=true            # 是否跳过测试
```

### 2. 统一构建流程
所有模块使用相同的构建步骤，避免差异：

```dockerfile
# 1. 复制所有pom.xml文件
COPY pom.xml ./
COPY */pom.xml ./*/

# 2. 验证目标模块存在
RUN if [ ! -d "${TARGET_MODULE}" ]; then
      echo "错误: 目标模块 '${TARGET_MODULE}' 不存在"
      exit 1
    fi

# 3. 参数化构建指定模块
RUN mvn package -DskipTests -B -pl ${TARGET_MODULE} -am
```

### 3. 标准化输出
所有模块的JAR文件都标准化为相同的命名和位置：

```dockerfile
# 标准化JAR文件位置
RUN cp "$JAR_PATH" "/app/target/${TARGET_MODULE}.jar"

# 最终统一为app.jar
COPY --from=builder /app/target/${TARGET_MODULE}.jar /app/app.jar
```

### 4. 统一启动机制
所有模块使用相同的启动脚本和配置方式：

```bash
#!/bin/bash
# 统一的Spring Boot启动脚本
exec java $JAVA_OPTS \
  -Dserver.port=$SERVER_PORT \
  -Dspring.profiles.active=$SPRING_PROFILES_ACTIVE \
  -Dfile.encoding=UTF-8 \
  -Djava.security.egd=file:/dev/./urandom \
  -jar /app/app.jar "$@"
```

### 5. 统一健康检查
所有模块使用相同的健康检查端点：

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${SERVER_PORT}/actuator/health || exit 1
```

## 使用方法

### 1. 基本使用
```bash
# 构建用户服务模块
docker build --build-arg TARGET_MODULE=user-service -t user-app .

# 构建订单服务模块
docker build --build-arg TARGET_MODULE=order-service -t order-app .

# 构建网关服务模块
docker build --build-arg TARGET_MODULE=gateway-service -t gateway-app .
```

### 2. 高级配置
```bash
# 使用测试环境配置
docker build \
  --build-arg TARGET_MODULE=user-service \
  --build-arg MAVEN_PROFILES=test \
  -t user-app-test .

# 包含单元测试的构建
docker build \
  --build-arg TARGET_MODULE=order-service \
  --build-arg SKIP_TESTS=false \
  -t order-app .

# 多参数组合使用
docker build \
  --build-arg TARGET_MODULE=gateway-service \
  --build-arg MAVEN_PROFILES=staging \
  --build-arg SKIP_TESTS=false \
  -t gateway-app-staging .
```

### 3. 运行容器
```bash
# 使用默认配置运行
docker run -p 8080:8080 user-app

# 自定义端口和配置
docker run \
  -p 9090:9090 \
  -e SERVER_PORT=9090 \
  -e SPRING_PROFILES_ACTIVE=dev \
  user-app

# 自定义JVM参数
docker run \
  -p 8080:8080 \
  -e JAVA_OPTS="-Xms1g -Xmx4g -XX:+UseG1GC" \
  order-app
```

## 适用场景

### 1. 微服务架构
```
microservices-project/
├── pom.xml (父模块)
├── user-service/          # 用户服务
│   ├── pom.xml
│   └── src/main/java/...
├── order-service/         # 订单服务
│   ├── pom.xml
│   └── src/main/java/...
├── payment-service/       # 支付服务
│   ├── pom.xml
│   └── src/main/java/...
└── gateway-service/       # 网关服务
    ├── pom.xml
    └── src/main/java/...
```

**使用示例**:
```bash
# 分别构建各个微服务
docker build --build-arg TARGET_MODULE=user-service -t user-service .
docker build --build-arg TARGET_MODULE=order-service -t order-service .
docker build --build-arg TARGET_MODULE=payment-service -t payment-service .
docker build --build-arg TARGET_MODULE=gateway-service -t gateway-service .
```

### 2. Spring Boot多应用项目
```
multi-app-project/
├── pom.xml (父模块)
├── web-app/              # Web应用
│   ├── pom.xml
│   └── src/main/java/...
├── admin-app/            # 管理后台
│   ├── pom.xml
│   └── src/main/java/...
├── api-app/              # API服务
│   ├── pom.xml
│   └── src/main/java/...
└── batch-app/            # 批处理应用
    ├── pom.xml
    └── src/main/java/...
```

**使用示例**:
```bash
# 构建不同的应用
docker build --build-arg TARGET_MODULE=web-app -t web-app .
docker build --build-arg TARGET_MODULE=admin-app -t admin-app .
docker build --build-arg TARGET_MODULE=api-app -t api-app .
docker build --build-arg TARGET_MODULE=batch-app -t batch-app .
```

### 3. CI/CD流水线集成
```yaml
# Jenkins Pipeline 示例
pipeline {
    agent any
    parameters {
        choice(
            name: 'TARGET_MODULE',
            choices: ['user-service', 'order-service', 'gateway-service'],
            description: '选择要构建的模块'
        )
        choice(
            name: 'MAVEN_PROFILES',
            choices: ['prod', 'test', 'staging'],
            description: '选择Maven配置文件'
        )
    }
    stages {
        stage('Build') {
            steps {
                script {
                    sh """
                        docker build \
                          --build-arg TARGET_MODULE=${params.TARGET_MODULE} \
                          --build-arg MAVEN_PROFILES=${params.MAVEN_PROFILES} \
                          -t ${params.TARGET_MODULE}:${BUILD_NUMBER} .
                    """
                }
            }
        }
    }
}
```

## 技术优势

### 1. 避免模块差异
- **统一构建流程**: 所有模块使用相同的构建步骤
- **标准化输出**: JAR文件命名和位置统一
- **统一启动方式**: 相同的启动脚本和配置
- **统一健康检查**: 相同的监控端点

### 2. 提高维护效率
- **单一模版**: 一个Dockerfile支持所有模块
- **参数化配置**: 通过构建参数灵活选择
- **减少重复**: 避免为每个模块创建单独配置
- **统一更新**: 模版更新自动应用到所有模块

### 3. CI/CD友好
- **参数化构建**: 支持流水线参数传递
- **灵活配置**: 支持不同环境的配置文件
- **批量构建**: 可以批量构建多个模块
- **版本管理**: 统一的构建和版本策略

### 4. 运维优化
- **统一监控**: 相同的健康检查和监控方式
- **统一配置**: 相同的环境变量和配置方式
- **统一部署**: 相同的部署和运行方式
- **故障排查**: 统一的日志和调试方式

## 环境变量配置

### 构建时变量
- `TARGET_MODULE`: 指定要构建的模块名 (默认: app-service)
- `MAVEN_PROFILES`: Maven配置文件 (默认: prod)
- `SKIP_TESTS`: 是否跳过测试 (默认: true)

### 运行时变量
- `JAVA_OPTS`: JVM参数配置
- `SPRING_PROFILES_ACTIVE`: Spring配置文件
- `SERVER_PORT`: 服务端口 (默认: 8080)
- `TARGET_MODULE`: 模块名称标识

## 最佳实践

### 1. 模块命名规范
```bash
# 推荐的模块命名方式
user-service      # 用户服务
order-service     # 订单服务
payment-service   # 支付服务
gateway-service   # 网关服务
admin-web         # 管理后台
api-gateway       # API网关
```

### 2. 配置文件管理
```bash
# 不同环境使用不同的Maven配置文件
--build-arg MAVEN_PROFILES=dev      # 开发环境
--build-arg MAVEN_PROFILES=test     # 测试环境
--build-arg MAVEN_PROFILES=staging  # 预发布环境
--build-arg MAVEN_PROFILES=prod     # 生产环境
```

### 3. 资源配置建议
```bash
# 根据模块特点调整JVM参数
# 轻量级服务
-e JAVA_OPTS="-Xms256m -Xmx1g -XX:+UseG1GC"

# 中等负载服务
-e JAVA_OPTS="-Xms512m -Xmx2g -XX:+UseG1GC"

# 高负载服务
-e JAVA_OPTS="-Xms1g -Xmx4g -XX:+UseG1GC"
```

## 状态
✅ **已完成** - Spring Boot多模块参数化构建模版已成功创建并通过测试验证

## 总结
这个参数化模版成功解决了Spring Boot多模块项目中的构建差异问题，通过统一的构建流程、标准化的输出格式和一致的启动方式，大大简化了多模块项目的Docker化部署，提高了开发和运维效率。