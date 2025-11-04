# 玄武工厂平台 - Kubernetes 部署指南

## 📋 前置要求

- Docker 20.10+
- Kubernetes 1.24+
- kubectl 已配置并连接到集群
- 镜像仓库访问权限（Docker Hub / Harbor / 阿里云等）
- 可用的 MySQL 8.0+ 数据库实例（支持外部或集群内访问）

## 🚀 快速开始

### 1. 构建 Docker 镜像

```bash
# 基础构建
./build-docker.sh

# 构建并推送到镜像仓库
PUSH_IMAGE=true IMAGE_TAG=v1.0.0 REGISTRY=your-registry.com ./build-docker.sh

# 本地测试
TEST_LOCAL=true ./build-docker.sh
```

### 2. 配置环境变量

编辑 `k8s-deployment.yaml`，修改以下配置：

```yaml
# Secret 部分 - 替换为实际的数据库配置
stringData:
  DATABASE_URL: "mysql://username:password@mysql-host:3306/xuanwu_factory"

# Deployment 部分 - 替换镜像地址
spec:
  template:
    spec:
      containers:
      - image: your-registry.com/xuanwu-factory:latest  # 修改此处

# Ingress 部分 - 配置域名
spec:
  rules:
  - host: factory.yourdomain.com  # 修改此处
```

### 3. 部署到 Kubernetes

```bash
# 应用配置
kubectl apply -f k8s-deployment.yaml

# 查看部署状态
kubectl get pods -n xuanwu-factory
kubectl get svc -n xuanwu-factory
kubectl get ingress -n xuanwu-factory

# 查看日志
kubectl logs -f deployment/xuanwu-factory -n xuanwu-factory
```

## 🔧 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | MySQL 连接字符串（提供给 Prisma 使用） | `mysql://username:password@mysql-host:3306/xuanwu_factory` |

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `NEXT_TELEMETRY_DISABLED` | 禁用遥测 | `1` |
| `KUBECONFIG_DATA` | 自定义 kubeconfig 内容（支持 YAML 或 Base64 编码） | - |
| `K8S_API_SERVER` | Kubernetes API Server 地址（使用 Token 模式时必填） | - |
| `K8S_BEARER_TOKEN` | 用于调用 Kubernetes API 的 Bearer Token | - |
| `K8S_CA_CERT_DATA` | 集群 CA 证书（Base64，可选） | - |
| `K8S_SKIP_TLS_VERIFY` | 是否跳过 TLS 校验（未提供 CA 时建议设为 `true`） | `false` |

### K8s 管理配置（如果应用需要管理 K8s 资源）

推荐使用仓库提供的脚本生成管理员 Token：

```bash
# 在拥有 kubectl 权限的节点（例如 master 节点）执行
chmod +x doc/k8s/generate-admin-token.sh
./doc/k8s/generate-admin-token.sh
```

脚本会创建 `xuanwu-factory-admin` ServiceAccount、授予 `cluster-admin` 权限，并打印 `K8S_API_SERVER`、`K8S_BEARER_TOKEN`、`K8S_CA_CERT_DATA` 以及可选的 `KUBECONFIG_DATA` 片段。
将这些值填入 `k8s-deployment.yaml` 中 `xuanwu-factory-secret` 的 `stringData` 字段后，重新应用部署：

```bash
kubectl apply -f k8s-deployment.yaml
```

> 如果你已经有现成的 kubeconfig，也可以直接将其原文或 Base64 字符串写入 `KUBECONFIG_DATA` 字段。

## 🔍 健康检查

应用提供了 `/api/health` 端点用于健康检查：

```bash
# 本地测试
curl http://localhost:3000/api/health

# K8s 内部
kubectl exec -it <pod-name> -n xuanwu-factory -- curl http://localhost:3000/api/health
```

响应示例：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production"
}
```

## 📊 监控与日志

### 查看 Pod 日志

```bash
# 实时日志
kubectl logs -f deployment/xuanwu-factory -n xuanwu-factory

# 查看最近 100 行
kubectl logs --tail=100 deployment/xuanwu-factory -n xuanwu-factory

# 查看特定 Pod
kubectl logs <pod-name> -n xuanwu-factory
```

### 查看 Pod 状态

```bash
# 详细状态
kubectl describe pod <pod-name> -n xuanwu-factory

# 资源使用
kubectl top pods -n xuanwu-factory
```

## 🔄 更新部署

### 滚动更新

```bash
# 更新镜像
kubectl set image deployment/xuanwu-factory \
  xuanwu-factory=your-registry.com/xuanwu-factory:v1.0.1 \
  -n xuanwu-factory

# 查看更新状态
kubectl rollout status deployment/xuanwu-factory -n xuanwu-factory

# 查看更新历史
kubectl rollout history deployment/xuanwu-factory -n xuanwu-factory
```

### 回滚

```bash
# 回滚到上一个版本
kubectl rollout undo deployment/xuanwu-factory -n xuanwu-factory

# 回滚到特定版本
kubectl rollout undo deployment/xuanwu-factory --to-revision=2 -n xuanwu-factory
```

## 🔐 安全建议

1. **使用私有镜像仓库**
   ```bash
   kubectl create secret docker-registry registry-secret \
     --docker-server=your-registry.com \
     --docker-username=your-username \
     --docker-password=your-password \
     -n xuanwu-factory
   ```

2. **配置 RBAC 权限**
   - 应用使用非 root 用户运行（UID: 1001）
   - 最小化 ServiceAccount 权限

3. **启用 Network Policy**（如果集群支持）

4. **定期更新镜像**
   ```bash
   # 扫描漏洞（使用 Trivy）
   trivy image your-registry.com/xuanwu-factory:latest
   ```

## 📈 扩缩容

### 手动扩缩容

```bash
# 扩容到 5 个副本
kubectl scale deployment/xuanwu-factory --replicas=5 -n xuanwu-factory
```

### 自动扩缩容（HPA）

HPA 已在 `k8s-deployment.yaml` 中配置：
- 最小副本数：2
- 最大副本数：10
- CPU 阈值：70%
- 内存阈值：80%

查看 HPA 状态：
```bash
kubectl get hpa -n xuanwu-factory
kubectl describe hpa xuanwu-factory -n xuanwu-factory
```

## 🛠️ 故障排查

### Pod 无法启动

```bash
# 查看 Pod 事件
kubectl describe pod <pod-name> -n xuanwu-factory

# 查看启动日志
kubectl logs <pod-name> -n xuanwu-factory --previous
```

### 健康检查失败

```bash
# 进入容器调试
kubectl exec -it <pod-name> -n xuanwu-factory -- sh

# 测试健康检查端点
curl http://localhost:3000/api/health
```

### 性能问题

```bash
# 查看资源使用
kubectl top pod <pod-name> -n xuanwu-factory

# 查看 Metrics
kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/xuanwu-factory/pods/<pod-name>
```

## 📦 资源配置建议

### 开发/测试环境

```yaml
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 500m
    memory: 1Gi
replicas: 1
```

### 生产环境

```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi
replicas: 3  # 最少 3 个副本保证高可用
```

## 🌐 Ingress 配置

### 使用 Nginx Ingress

已在 `k8s-deployment.yaml` 中配置，需要集群安装 Nginx Ingress Controller。

### 启用 HTTPS（使用 cert-manager）

```bash
# 1. 安装 cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# 2. 创建 ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# 3. 在 Ingress 中启用 TLS（已在配置文件中注释，取消注释即可）
```

## 📞 支持

如有问题，请查看：
- 应用日志：`kubectl logs -f deployment/xuanwu-factory -n xuanwu-factory`
- K8s 事件：`kubectl get events -n xuanwu-factory --sort-by='.lastTimestamp'`
- 健康检查：`curl http://localhost:3000/api/health`
