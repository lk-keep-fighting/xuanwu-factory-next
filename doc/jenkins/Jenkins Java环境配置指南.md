# Jenkins Java构建环境配置指南

## 🚨 问题描述

Java JAR构建失败，错误信息：
```
mvn: not found
```

这表明Jenkins执行节点上缺少Maven工具。

## 🔧 解决方案

### 方案1：安装Maven和Gradle到Jenkins节点（推荐）

#### 1.1 通过包管理器安装

**Ubuntu/Debian系统**：
```bash
# 更新包列表
sudo apt update

# 安装Maven
sudo apt install maven -y

# 安装Gradle
sudo apt install gradle -y

# 验证安装
mvn -version
gradle -version
```

**CentOS/RHEL系统**：
```bash
# 安装Maven
sudo yum install maven -y

# 安装Gradle（需要EPEL仓库）
sudo yum install epel-release -y
sudo yum install gradle -y

# 验证安装
mvn -version
gradle -version
```

#### 1.2 手动安装到/opt目录

**安装Maven**：
```bash
# 下载Maven
cd /tmp
wget https://archive.apache.org/dist/maven/maven-3/3.9.5/binaries/apache-maven-3.9.5-bin.tar.gz

# 解压到/opt
sudo tar -xzf apache-maven-3.9.5-bin.tar.gz -C /opt/
sudo ln -s /opt/apache-maven-3.9.5 /opt/maven

# 设置环境变量
echo 'export PATH=/opt/maven/bin:$PATH' | sudo tee -a /etc/profile
source /etc/profile

# 验证
/opt/maven/bin/mvn -version
```

**安装Gradle**：
```bash
# 下载Gradle
cd /tmp
wget https://services.gradle.org/distributions/gradle-8.4-bin.zip

# 解压到/opt
sudo unzip gradle-8.4-bin.zip -d /opt/
sudo ln -s /opt/gradle-8.4 /opt/gradle

# 设置环境变量
echo 'export PATH=/opt/gradle/bin:$PATH' | sudo tee -a /etc/profile
source /etc/profile

# 验证
/opt/gradle/bin/gradle -version
```

### 方案2：使用Jenkins工具管理（推荐）

#### 2.1 配置Maven工具

1. **登录Jenkins管理界面**
2. **进入工具配置**：
   - 管理Jenkins → Global Tool Configuration
3. **配置Maven**：
   - 找到"Maven"部分
   - 点击"新增Maven"
   - 名称：`Maven-3.9.5`
   - 勾选"自动安装"
   - 选择版本：`3.9.5`
   - 保存配置

#### 2.2 配置Gradle工具

1. **在同一页面找到"Gradle"部分**
2. **配置Gradle**：
   - 点击"新增Gradle"
   - 名称：`Gradle-8.4`
   - 勾选"自动安装"
   - 选择版本：`8.4`
   - 保存配置

#### 2.3 修改Pipeline脚本使用工具

```groovy
pipeline {
  agent any
  tools {
    maven 'Maven-3.9.5'
    gradle 'Gradle-8.4'
  }
  // ... 其他配置
}
```

### 方案3：使用Docker Agent（高级）

修改Jenkins Job使用Docker容器执行构建：

```groovy
pipeline {
  agent {
    docker {
      image 'maven:3.9.5-openjdk-17'
      args '-v /var/run/docker.sock:/var/run/docker.sock'
    }
  }
  // ... 构建步骤
}
```

### 方案4：项目使用Wrapper（最简单）

**Maven Wrapper**：
确保项目根目录包含：
- `mvnw` (Unix)
- `mvnw.cmd` (Windows)
- `.mvn/wrapper/` 目录

**Gradle Wrapper**：
确保项目根目录包含：
- `gradlew` (Unix)
- `gradlew.bat` (Windows)
- `gradle/wrapper/` 目录

## 🎯 推荐配置流程

### 1. 快速解决（使用包管理器）

```bash
# 在Jenkins节点上执行
sudo apt update
sudo apt install maven gradle openjdk-17-jdk -y

# 验证安装
java -version
mvn -version
gradle -version
```

### 2. 验证Jenkins配置

1. **检查Jenkins节点**：
   - 管理Jenkins → 管理节点
   - 选择执行节点
   - 点击"脚本控制台"

2. **运行验证脚本**：
```groovy
println "Java: " + "java -version".execute().text
println "Maven: " + "mvn -version".execute().text
println "Gradle: " + "gradle -version".execute().text
```

### 3. 测试构建

重新触发Java JAR服务的构建，应该看到：
```
=== Environment Setup ===
JAVA_HOME: /usr/lib/jvm/java-17-openjdk-amd64
Maven found: Apache Maven 3.9.5
Gradle found: Gradle 8.4
==========================
```

## 🔍 故障排查

### 常见问题

#### 1. Maven仍然找不到
```bash
# 检查PATH
echo $PATH

# 检查Maven位置
which mvn
ls -la /usr/bin/mvn
ls -la /opt/maven/bin/mvn
```

#### 2. Java版本不匹配
```bash
# 检查可用的Java版本
update-alternatives --list java

# 设置默认Java版本
sudo update-alternatives --config java
```

#### 3. 权限问题
```bash
# 确保Jenkins用户有执行权限
sudo chown -R jenkins:jenkins /opt/maven
sudo chown -R jenkins:jenkins /opt/gradle
```

### 调试命令

在Jenkins Job中添加调试步骤：
```groovy
stage('Debug Environment') {
  steps {
    sh '''
      echo "=== Debug Info ==="
      whoami
      pwd
      echo "PATH: $PATH"
      echo "JAVA_HOME: $JAVA_HOME"
      which java || echo "java not found"
      which mvn || echo "mvn not found"
      which gradle || echo "gradle not found"
      ls -la /usr/bin/ | grep -E "(mvn|gradle)" || echo "No build tools in /usr/bin"
      ls -la /opt/ || echo "No /opt directory"
      echo "=================="
    '''
  }
}
```

## 📝 最终验证

配置完成后，重新触发构建应该看到：
1. ✅ 环境检查通过
2. ✅ Maven/Gradle工具找到
3. ✅ Java项目构建成功
4. ✅ JAR包生成并上传到Nexus

---

**推荐顺序**：
1. 先尝试方案1（包管理器安装）
2. 如果不行，使用方案2（Jenkins工具管理）
3. 长期考虑方案3（Docker Agent）