# Maven Not Found 快速修复指南

## 🚨 当前问题

Java JAR构建失败，错误信息：
```
mvn: not found
```

Jenkins Job已经成功触发，但Jenkins节点缺少Maven工具。

## ⚡ 快速修复方案

### 方案1：在Jenkins节点安装Maven（最快）

**登录Jenkins节点服务器，执行以下命令**：

```bash
# Ubuntu/Debian系统
sudo apt update
sudo apt install maven openjdk-17-jdk -y

# CentOS/RHEL系统  
sudo yum install maven java-17-openjdk-devel -y

# 验证安装
java -version
mvn -version
```

### 方案2：使用已更新的Jenkins脚本

我已经更新了Jenkins脚本，现在支持：
1. **Maven Wrapper**: 如果项目有`./mvnw`文件
2. **多路径检测**: 检查`/opt/maven/bin/mvn`等路径
3. **更好的错误提示**: 明确指出缺少什么工具

**更新Jenkins Job脚本**：
1. 进入Jenkins → CICD-STD → build-java-jar
2. 点击"配置"
3. 将Pipeline脚本替换为`doc/jenkins/脚本/build-java-jar`的最新内容
4. 保存

### 方案3：项目添加Maven Wrapper（推荐给开发团队）

**在Java项目中添加Maven Wrapper**：
```bash
# 在项目根目录执行
mvn wrapper:wrapper

# 提交到Git
git add mvnw mvnw.cmd .mvn/
git commit -m "Add Maven Wrapper"
git push
```

## 🔧 详细安装步骤

### Ubuntu/Debian系统安装

```bash
# 1. 更新包列表
sudo apt update

# 2. 安装Java和Maven
sudo apt install openjdk-17-jdk maven -y

# 3. 验证安装
java -version
# 应该显示: openjdk version "17.x.x"

mvn -version  
# 应该显示: Apache Maven 3.x.x

# 4. 检查环境变量
echo $JAVA_HOME
# 如果为空，设置JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
```

### CentOS/RHEL系统安装

```bash
# 1. 安装Java和Maven
sudo yum install java-17-openjdk-devel maven -y

# 2. 验证安装
java -version
mvn -version

# 3. 设置JAVA_HOME（如果需要）
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk' >> ~/.bashrc
```

### Docker环境安装

如果Jenkins运行在Docker中：

```bash
# 进入Jenkins容器
docker exec -it jenkins_container_name bash

# 安装Maven
apt update && apt install maven -y

# 或者重建Jenkins镜像，在Dockerfile中添加：
# RUN apt update && apt install -y maven openjdk-17-jdk
```

## 🎯 验证修复

### 1. 检查工具安装

在Jenkins节点上执行：
```bash
which java
which mvn
java -version
mvn -version
```

### 2. 测试Jenkins Job

1. 进入Jenkins → CICD-STD → build-java-jar
2. 点击"立即构建"
3. 填写测试参数
4. 查看构建日志，应该看到：

```
=== Environment Setup ===
JAVA_HOME: /usr/lib/jvm/java-17-openjdk-amd64
Maven found: Apache Maven 3.x.x
==========================
```

### 3. 重新触发平台构建

1. 回到平台服务页面
2. 点击"触发构建"
3. 应该看到构建成功进行

## 🔍 故障排查

### 如果Maven仍然找不到

```bash
# 检查PATH环境变量
echo $PATH

# 查找Maven安装位置
find /usr -name "mvn" 2>/dev/null
find /opt -name "mvn" 2>/dev/null

# 创建软链接（如果Maven安装在非标准位置）
sudo ln -s /path/to/maven/bin/mvn /usr/local/bin/mvn
```

### 如果Java版本不对

```bash
# 查看可用Java版本
sudo update-alternatives --list java

# 设置默认Java版本
sudo update-alternatives --config java
```

## 📋 完整环境检查清单

安装完成后，确认以下命令都能正常执行：

- [ ] `java -version` - 显示Java 17或更高版本
- [ ] `mvn -version` - 显示Maven版本
- [ ] `echo $JAVA_HOME` - 显示Java安装路径
- [ ] `echo $PATH` - 包含Java和Maven的bin目录

## 🚀 预期结果

修复后，重新触发构建应该看到：

1. ✅ 环境检查通过
2. ✅ Maven工具找到
3. ✅ Java项目开始构建
4. ✅ JAR包生成成功

---

**推荐操作顺序**：
1. 先执行方案1（安装Maven）
2. 更新Jenkins脚本（方案2）
3. 重新测试构建
4. 如果仍有问题，检查故障排查部分