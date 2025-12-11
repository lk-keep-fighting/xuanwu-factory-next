# AI 诊断助手 - 示例场景

## 目录

- [场景 1：Pod 启动失败 - ImagePullBackOff](#场景-1pod-启动失败---imagepullbackoff)
- [场景 2：应用程序崩溃 - CrashLoopBackOff](#场景-2应用程序崩溃---crashloopbackoff)
- [场景 3：内存不足 - OOMKilled](#场景-3内存不足---oomkilled)
- [场景 4：CPU 使用率过高](#场景-4cpu-使用率过高)
- [场景 5：数据库连接失败](#场景-5数据库连接失败)
- [场景 6：配置错误 - ConfigMap 缺失](#场景-6配置错误---configmap-缺失)
- [场景 7：日志分析 - 应用程序错误](#场景-7日志分析---应用程序错误)
- [场景 8：网络超时问题](#场景-8网络超时问题)

---

## 场景 1：Pod 启动失败 - ImagePullBackOff

### 问题描述

服务部署后，Pod 一直无法启动，状态显示为 `ImagePullBackOff`。

### 用户提问

```
"我的服务启动失败了，Pod 状态显示 ImagePullBackOff"
```

### AI 诊断过程

**步骤 1：查询 Pod 状态**
```
🔍 调用工具：getPodStatus
状态：运行中...
```

**步骤 2：分析结果**

AI 发现：
- Pod 状态：ImagePullBackOff
- 事件信息：Failed to pull image "myapp:v1.0.0": rpc error: code = Unknown desc = Error response from daemon: pull access denied

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的服务 Pod 处于 **ImagePullBackOff** 状态，这表示 Kubernetes 无法拉取容器镜像。

### 📊 详细分析
根据 Pod 事件，发现以下问题：
- **错误类型**：镜像拉取失败
- **错误信息**：pull access denied
- **镜像名称**：myapp:v1.0.0

### 🎯 根本原因
镜像拉取失败的常见原因：
1. **镜像不存在**：指定的镜像标签在仓库中不存在
2. **权限不足**：没有配置镜像仓库的访问凭证
3. **仓库地址错误**：镜像仓库地址配置错误
4. **网络问题**：无法访问镜像仓库

根据错误信息 "pull access denied"，最可能的原因是 **权限不足**。

### 💡 解决建议

**方案 1：检查镜像是否存在**
```bash
# 在本地或 CI/CD 环境中验证镜像
docker pull myapp:v1.0.0
```

**方案 2：配置镜像拉取凭证**
```bash
# 创建 Docker Registry Secret
kubectl create secret docker-registry regcred \
  --docker-server=<your-registry-server> \
  --docker-username=<your-name> \
  --docker-password=<your-password> \
  --docker-email=<your-email>

# 在 Deployment 中引用
spec:
  template:
    spec:
      imagePullSecrets:
      - name: regcred
```

**方案 3：使用公共镜像仓库**
如果是私有镜像，考虑推送到公共仓库（如 Docker Hub）进行测试。

### 📝 验证步骤
1. 确认镜像存在且标签正确
2. 配置镜像拉取凭证
3. 更新 Deployment 配置
4. 等待 Pod 重新拉取镜像
5. 检查 Pod 状态是否变为 Running
```

### 后续对话

**用户**："如何查看我配置的镜像仓库地址？"

**AI**：
```markdown
可以通过以下方式查看镜像配置：

**方法 1：查看 Deployment 配置**
我已经为您获取了部署配置，镜像配置如下：
- 镜像：myapp:v1.0.0
- 拉取策略：IfNotPresent

**方法 2：检查 imagePullSecrets**
当前 Deployment 没有配置 imagePullSecrets，这就是为什么无法拉取私有镜像的原因。

**建议**：
如果这是私有镜像，请按照上面的方案 2 配置镜像拉取凭证。
```

---

## 场景 2：应用程序崩溃 - CrashLoopBackOff

### 问题描述

应用程序启动后立即崩溃，Pod 不断重启。

### 用户提问

```
"Pod 一直在重启，状态是 CrashLoopBackOff，怎么回事？"
```

### AI 诊断过程

**步骤 1：查询 Pod 状态**
```
🔍 调用工具：getPodStatus
发现：Pod 重启次数 15 次，退出代码 1
```

**步骤 2：读取日志**
```
📝 调用工具：getServiceLogs
发现：应用启动时报错 "Error: Cannot find module 'express'"
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的 Pod 处于 **CrashLoopBackOff** 状态，已经重启了 **15 次**。

### 📊 详细分析
- **退出代码**：1（表示应用程序异常退出）
- **重启次数**：15 次
- **重启间隔**：逐渐增加（Kubernetes 的退避策略）

从日志中发现关键错误：
```
Error: Cannot find module 'express'
    at Function.Module._resolveFilename (internal/modules/cjs/loader.js:815:15)
    at Function.Module._load (internal/modules/cjs/loader.js:667:27)
```

### 🎯 根本原因
应用程序缺少必需的依赖包 `express`。这通常是因为：
1. **构建镜像时未安装依赖**：Dockerfile 中缺少 `npm install` 步骤
2. **node_modules 未包含在镜像中**：.dockerignore 错误配置
3. **依赖版本不匹配**：package.json 和实际安装的版本不一致

### 💡 解决建议

**方案 1：检查 Dockerfile**
确保 Dockerfile 包含依赖安装步骤：
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

CMD ["node", "server.js"]
```

**方案 2：重新构建镜像**
```bash
# 重新构建镜像
docker build -t myapp:v1.0.1 .

# 推送到仓库
docker push myapp:v1.0.1

# 更新 Deployment
kubectl set image deployment/myapp myapp=myapp:v1.0.1
```

**方案 3：临时验证**
在本地验证镜像是否正常：
```bash
docker run -it myapp:v1.0.0 sh
# 在容器中检查
ls node_modules/express
```

### 📝 预防措施
1. 在 CI/CD 中添加镜像验证步骤
2. 使用多阶段构建确保依赖完整
3. 添加健康检查确保应用正常启动
```

---

## 场景 3：内存不足 - OOMKilled

### 问题描述

应用程序运行一段时间后被系统杀死，Pod 重启。

### 用户提问

```
"服务运行一会儿就自动重启了，日志里看到 OOMKilled"
```

### AI 诊断过程

**步骤 1：查询 Pod 状态**
```
🔍 调用工具：getPodStatus
发现：最后终止原因 OOMKilled
```

**步骤 2：查询资源使用**
```
📊 调用工具：getResourceMetrics
发现：内存使用 480MB，限制 512MB（使用率 93.75%）
```

**步骤 3：查看配置**
```
⚙️ 调用工具：getDeploymentConfig
发现：内存限制 512Mi，请求 256Mi
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的 Pod 因为 **内存不足（OOM - Out Of Memory）** 被系统强制终止。

### 📊 详细分析
**当前资源配置：**
- 内存请求（Request）：256Mi
- 内存限制（Limit）：512Mi
- 当前使用：480Mi
- 使用率：93.75%

**问题分析：**
Pod 的内存使用接近限制值，当超过 512Mi 时，Kubernetes 会终止容器（OOMKilled）。

### 🎯 根本原因
可能的原因：
1. **内存限制设置过低**：应用实际需要更多内存
2. **内存泄漏**：应用存在内存泄漏问题
3. **流量突增**：请求量增加导致内存使用上升
4. **缓存过大**：应用缓存了过多数据

### 💡 解决建议

**短期方案：增加内存限制**
```yaml
resources:
  requests:
    memory: "512Mi"
  limits:
    memory: "1Gi"  # 增加到 1GB
```

更新配置：
```bash
kubectl edit deployment myapp
# 或使用 kubectl patch
kubectl patch deployment myapp -p '{"spec":{"template":{"spec":{"containers":[{"name":"myapp","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

**中期方案：监控内存使用趋势**
1. 观察内存使用是否持续增长（可能是内存泄漏）
2. 分析内存使用峰值时间（可能与流量相关）
3. 使用性能分析工具（如 Node.js 的 heapdump）

**长期方案：优化应用**
如果确认是内存泄漏：
1. 使用内存分析工具定位泄漏点
2. 检查是否有未释放的资源（数据库连接、文件句柄等）
3. 优化缓存策略
4. 考虑使用外部缓存（Redis）

### 📝 验证步骤
1. 增加内存限制
2. 重启 Pod
3. 持续监控内存使用情况
4. 如果内存持续增长，需要排查内存泄漏
```

---

## 场景 4：CPU 使用率过高

### 问题描述

服务响应变慢，CPU 使用率持续很高。

### 用户提问

```
"服务响应很慢，CPU 使用率一直在 90% 以上"
```


### AI 诊断过程

**步骤 1：查询资源使用**
```
📊 调用工具：getResourceMetrics
发现：CPU 使用 950m，限制 1000m（使用率 95%）
```

**步骤 2：查看配置**
```
⚙️ 调用工具：getDeploymentConfig
发现：CPU 限制 1 核，副本数 1
```

**步骤 3：查看日志**
```
📝 调用工具：getServiceLogs
发现：大量请求日志，响应时间较长
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的服务 CPU 使用率达到 **95%**，已经接近限制值，这会导致：
- 请求响应变慢
- 可能出现超时
- 服务质量下降

### 📊 详细分析
**当前资源配置：**
- CPU 请求：500m（0.5 核）
- CPU 限制：1000m（1 核）
- 当前使用：950m
- 使用率：95%
- 副本数：1

**流量情况：**
从日志中看到大量请求，平均响应时间 800ms，说明服务负载较高。

### 🎯 根本原因
可能的原因：
1. **流量增加**：请求量超过单个实例的处理能力
2. **CPU 限制过低**：分配的 CPU 资源不足
3. **代码性能问题**：存在 CPU 密集型操作
4. **副本数不足**：只有一个实例处理所有请求

### 💡 解决建议

**方案 1：水平扩容（推荐）**
增加 Pod 副本数来分散负载：
```bash
kubectl scale deployment myapp --replicas=3
```

或更新 Deployment：
```yaml
spec:
  replicas: 3  # 增加到 3 个副本
```

**方案 2：增加 CPU 限制**
如果单个实例需要更多 CPU：
```yaml
resources:
  requests:
    cpu: "1000m"
  limits:
    cpu: "2000m"  # 增加到 2 核
```

**方案 3：配置自动扩容（HPA）**
根据 CPU 使用率自动调整副本数：
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70  # 目标 70%
```

**方案 4：性能优化**
如果是代码问题：
1. 使用性能分析工具找出 CPU 热点
2. 优化算法和数据结构
3. 使用缓存减少计算
4. 异步处理耗时操作

### 📝 推荐方案
**立即执行：** 扩容到 3 个副本
```bash
kubectl scale deployment myapp --replicas=3
```

**后续优化：** 配置 HPA 实现自动扩缩容

**长期改进：** 分析代码性能，优化 CPU 密集型操作
```

---

## 场景 5：数据库连接失败

### 问题描述

应用程序无法连接到数据库，报连接超时错误。

### 用户提问

```
"服务无法连接到 MySQL 数据库，一直报 Connection timeout"
```

### AI 诊断过程

**步骤 1：查看日志**
```
📝 调用工具：getServiceLogs
发现：Error: connect ETIMEDOUT 10.0.0.100:3306
```

**步骤 2：查看配置**
```
⚙️ 调用工具：getDeploymentConfig
发现：环境变量 DB_HOST=mysql-service
```

**步骤 3：查看 Pod 状态**
```
🔍 调用工具：getPodStatus
发现：Pod 运行正常，无网络相关事件
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的应用无法连接到 MySQL 数据库，错误信息显示 **连接超时（ETIMEDOUT）**。

### 📊 详细分析
**错误信息：**
```
Error: connect ETIMEDOUT 10.0.0.100:3306
```

**配置信息：**
- 数据库地址：mysql-service（环境变量 DB_HOST）
- 数据库端口：3306（默认）
- 解析后的 IP：10.0.0.100

**Pod 状态：**
- Pod 运行正常
- 无网络相关错误事件

### 🎯 根本原因
连接超时的可能原因：
1. **数据库服务不可用**：MySQL 服务未启动或已停止
2. **网络策略阻止**：Kubernetes NetworkPolicy 阻止了连接
3. **服务名称错误**：DNS 解析失败或服务名配置错误
4. **端口配置错误**：数据库端口不是 3306
5. **防火墙规则**：网络防火墙阻止了连接

### 💡 解决建议

**步骤 1：验证数据库服务是否存在**
```bash
kubectl get service mysql-service
```

如果服务不存在，需要先部署 MySQL 服务。

**步骤 2：测试网络连接**
在应用 Pod 中测试连接：
```bash
# 进入 Pod
kubectl exec -it <pod-name> -- sh

# 测试 DNS 解析
nslookup mysql-service

# 测试端口连接
nc -zv mysql-service 3306
# 或
telnet mysql-service 3306
```

**步骤 3：检查 NetworkPolicy**
```bash
kubectl get networkpolicy
```

如果有 NetworkPolicy，确保允许应用访问数据库：
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-mysql
spec:
  podSelector:
    matchLabels:
      app: myapp
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mysql
    ports:
    - protocol: TCP
      port: 3306
```

**步骤 4：验证数据库配置**
确认环境变量配置正确：
```yaml
env:
- name: DB_HOST
  value: "mysql-service"  # 或使用完整域名：mysql-service.default.svc.cluster.local
- name: DB_PORT
  value: "3306"
- name: DB_USER
  valueFrom:
    secretKeyRef:
      name: mysql-secret
      key: username
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: mysql-secret
      key: password
```

**步骤 5：检查数据库服务状态**
```bash
# 查看 MySQL Pod 状态
kubectl get pods -l app=mysql

# 查看 MySQL 日志
kubectl logs <mysql-pod-name>
```

### 📝 排查清单
- [ ] 数据库服务存在且运行正常
- [ ] DNS 可以解析服务名
- [ ] 端口 3306 可以连接
- [ ] 没有 NetworkPolicy 阻止连接
- [ ] 数据库用户名和密码正确
- [ ] 数据库允许远程连接
```

---

## 场景 6：配置错误 - ConfigMap 缺失

### 问题描述

应用启动失败，提示找不到配置文件。

### 用户提问

```
"服务启动后立即退出，日志显示找不到配置文件"
```

### AI 诊断过程

**步骤 1：查看日志**
```
📝 调用工具：getServiceLogs
发现：Error: ENOENT: no such file or directory, open '/app/config/app.conf'
```

**步骤 2：查看配置**
```
⚙️ 调用工具：getDeploymentConfig
发现：挂载了 ConfigMap "app-config"，但 ConfigMap 不存在
```

**步骤 3：查看 Pod 状态**
```
🔍 调用工具：getPodStatus
发现：事件显示 "MountVolume.SetUp failed: configmap 'app-config' not found"
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的应用启动失败，原因是 **ConfigMap 不存在**，导致配置文件无法挂载。

### 📊 详细分析
**错误信息：**
```
Error: ENOENT: no such file or directory, open '/app/config/app.conf'
MountVolume.SetUp failed: configmap 'app-config' not found
```

**配置信息：**
- 期望的 ConfigMap：app-config
- 挂载路径：/app/config
- 配置文件：app.conf

### 🎯 根本原因
ConfigMap "app-config" 不存在。可能的原因：
1. **ConfigMap 未创建**：忘记创建 ConfigMap
2. **名称不匹配**：ConfigMap 名称与 Deployment 中引用的不一致
3. **命名空间错误**：ConfigMap 在不同的命名空间
4. **ConfigMap 被删除**：之前存在但被误删除

### 💡 解决建议

**方案 1：创建 ConfigMap**

从文件创建：
```bash
kubectl create configmap app-config --from-file=app.conf
```

从字面值创建：
```bash
kubectl create configmap app-config \
  --from-literal=database.host=mysql-service \
  --from-literal=database.port=3306
```

从 YAML 创建：
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.conf: |
    database:
      host: mysql-service
      port: 3306
    server:
      port: 8080
```

应用配置：
```bash
kubectl apply -f configmap.yaml
```

**方案 2：检查 ConfigMap 是否存在**
```bash
# 列出所有 ConfigMap
kubectl get configmap

# 查看特定 ConfigMap
kubectl get configmap app-config -o yaml
```

**方案 3：验证 Deployment 配置**
确保 Deployment 正确引用 ConfigMap：
```yaml
spec:
  template:
    spec:
      containers:
      - name: myapp
        volumeMounts:
        - name: config
          mountPath: /app/config
      volumes:
      - name: config
        configMap:
          name: app-config  # 确保名称正确
```

**方案 4：使用环境变量替代（临时方案）**
如果配置简单，可以使用环境变量：
```yaml
env:
- name: DB_HOST
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: database.host
```

### 📝 验证步骤
1. 创建 ConfigMap
2. 验证 ConfigMap 存在：`kubectl get configmap app-config`
3. 重启 Pod：`kubectl rollout restart deployment myapp`
4. 检查 Pod 状态是否变为 Running
5. 验证配置文件已挂载：`kubectl exec <pod> -- ls /app/config`
```

---

## 场景 7：日志分析 - 应用程序错误

### 问题描述

应用程序运行正常，但日志中出现大量错误。

### 用户提问

```
"应用日志里一直有错误，但 Pod 状态是 Running，这正常吗？"
```


### AI 诊断过程

**步骤 1：查看 Pod 状态**
```
🔍 调用工具：getPodStatus
发现：Pod 状态 Running，无重启
```

**步骤 2：读取日志**
```
📝 调用工具：getServiceLogs
发现：大量 "TypeError: Cannot read property 'id' of undefined" 错误
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的 Pod 状态是 **Running**，但日志中出现大量应用程序错误。这说明：
- 容器进程没有崩溃
- 但应用程序逻辑存在问题
- 可能影响部分功能

### 📊 详细分析
**日志中的错误：**
```
TypeError: Cannot read property 'id' of undefined
    at /app/src/handlers/user.js:45:23
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
```

**错误频率：**
- 每分钟约 20 次
- 主要集中在用户相关接口
- 错误率约 15%

### 🎯 根本原因
这是一个典型的 **空指针错误（Null Pointer Exception）**：
- 代码尝试访问 `undefined` 对象的 `id` 属性
- 发生在 `/app/src/handlers/user.js` 第 45 行
- 可能是因为：
  1. 数据库查询返回空结果
  2. API 请求缺少必需参数
  3. 数据验证不充分

### 💡 解决建议

**短期方案：添加错误处理**
在 `user.js` 第 45 行添加空值检查：
```javascript
// ❌ 错误的代码
const userId = user.id;

// ✅ 正确的代码
const userId = user?.id || null;
// 或
if (!user) {
  return res.status(404).json({ error: 'User not found' });
}
const userId = user.id;
```

**中期方案：增强数据验证**
```javascript
// 在路由处理器中添加验证
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        userId: req.params.id 
      });
    }
    
    res.json({ userId: user.id, name: user.name });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**长期方案：完善错误监控**
1. 集成错误追踪服务（如 Sentry）
2. 添加结构化日志
3. 设置错误告警
4. 定期审查错误日志

### 📝 调试步骤
1. 定位具体的代码位置（user.js:45）
2. 检查该位置的数据来源
3. 添加空值检查和错误处理
4. 重新部署应用
5. 监控错误是否消失

### ⚠️ 注意事项
虽然 Pod 状态是 Running，但应用程序错误会：
- 影响用户体验
- 导致部分功能不可用
- 可能引发数据不一致
- 建议尽快修复
```

---

## 场景 8：网络超时问题

### 问题描述

服务调用外部 API 时频繁超时。

### 用户提问

```
"调用第三方 API 经常超时，但有时候又能成功"
```

### AI 诊断过程

**步骤 1：查看日志**
```
📝 调用工具：getServiceLogs
发现：大量 "Error: Request timeout" 和 "ETIMEDOUT"
```

**步骤 2：查看资源使用**
```
📊 调用工具：getResourceMetrics
发现：资源使用正常，CPU 40%，内存 60%
```

**步骤 3：查看配置**
```
⚙️ 调用工具：getDeploymentConfig
发现：未配置超时时间，使用默认值
```

### AI 响应示例

```markdown
## 诊断结果

### 🔍 问题观察
您的服务在调用外部 API 时出现 **间歇性超时**，特征：
- 有时成功，有时失败
- 错误信息：Request timeout / ETIMEDOUT
- 资源使用正常，不是性能问题

### 📊 详细分析
**日志分析：**
```
Error: Request timeout after 5000ms
Error: connect ETIMEDOUT 203.0.113.10:443
```

**超时统计：**
- 超时频率：约 30% 的请求
- 超时时间：5 秒（默认值）
- 成功请求平均响应时间：3-4 秒

**资源状态：**
- CPU 使用：40%（正常）
- 内存使用：60%（正常）
- 网络连接：正常

### 🎯 根本原因
间歇性超时的可能原因：
1. **外部 API 响应慢**：第三方服务性能不稳定
2. **超时设置过短**：5 秒可能不够
3. **网络不稳定**：到外部服务的网络质量差
4. **并发限制**：外部 API 有速率限制
5. **DNS 解析慢**：域名解析耗时

### 💡 解决建议

**方案 1：增加超时时间**
```javascript
// ❌ 默认超时（可能太短）
const response = await fetch(apiUrl);

// ✅ 设置合理的超时
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 秒

try {
  const response = await fetch(apiUrl, {
    signal: controller.signal
  });
  clearTimeout(timeoutId);
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timeout after 15s');
  }
}
```

**方案 2：实现重试机制**
```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        timeout: 15000
      });
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // 指数退避
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**方案 3：使用连接池**
```javascript
const http = require('http');
const https = require('https');

// 配置连接池
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 15000
});

// 使用连接池
const response = await fetch(apiUrl, { agent });
```

**方案 4：添加熔断器**
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// 使用熔断器
const breaker = new CircuitBreaker();
const result = await breaker.execute(() => fetch(apiUrl));
```

**方案 5：监控和告警**
```javascript
// 记录 API 调用指标
const metrics = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  timeoutRequests: 0,
  avgResponseTime: 0
};

async function monitoredFetch(url) {
  const startTime = Date.now();
  metrics.totalRequests++;

  try {
    const response = await fetch(url, { timeout: 15000 });
    metrics.successRequests++;
    
    const responseTime = Date.now() - startTime;
    metrics.avgResponseTime = 
      (metrics.avgResponseTime * (metrics.successRequests - 1) + responseTime) 
      / metrics.successRequests;
    
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      metrics.timeoutRequests++;
    } else {
      metrics.failedRequests++;
    }
    throw error;
  }
}
```

### 📝 推荐方案
**立即执行：**
1. 增加超时时间到 15 秒
2. 实现简单的重试机制（最多 3 次）

**后续优化：**
1. 添加连接池提高性能
2. 实现熔断器防止雪崩
3. 添加监控和告警

**长期改进：**
1. 与第三方服务商沟通性能问题
2. 考虑使用缓存减少 API 调用
3. 评估是否需要备用 API
```

---

## 总结

### 使用这些示例的建议

1. **参考相似场景**：找到与您问题最相似的场景
2. **理解诊断流程**：学习 AI 如何分析问题
3. **应用解决方案**：根据建议解决您的问题
4. **举一反三**：将方法应用到其他问题

### 常见问题模式

| 问题类型 | 关键特征 | 首要检查 |
|---------|---------|---------|
| 启动失败 | CrashLoopBackOff | Pod 状态和日志 |
| 镜像问题 | ImagePullBackOff | 镜像配置和凭证 |
| 资源不足 | OOMKilled | 资源使用和限制 |
| 性能问题 | 响应慢 | CPU/内存使用率 |
| 网络问题 | 连接失败/超时 | 网络配置和日志 |
| 配置错误 | 启动即退出 | ConfigMap/Secret |

### 获取更多帮助

- 📖 [用户使用指南](./AI_DIAGNOSTIC_USER_GUIDE.md)
- ❓ [常见问题 FAQ](./AI_DIAGNOSTIC_FAQ.md)
- 🚀 [快速开始](./AI_DIAGNOSTIC_QUICK_START.md)
- 🔧 [故障排查](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)

---

**最后更新**：2024-12-05  
**版本**：1.0.0  
**维护者**：开发团队
