# 大文件上传支持

## 概述

文件上传功能支持两种方式：

| 方式 | 文件大小限制 | 性能 | 要求 |
|------|------------|------|------|
| **WebSocket exec** | 最大 50MB | 较慢 | 无需额外配置 |
| **kubectl cp** | 无限制（推荐） | 快速 | 需要配置 kubectl |

## 工作原理

### WebSocket exec 方式

```
客户端 → Next.js API → K8s API (WebSocket) → Pod 容器
                        ↓ 通过 stdin 传输
```

- 通过 `@kubernetes/client-node` 的 exec 接口
- 文件内容通过 stdin 传输到 `cat > file` 命令
- 适合小文件（< 10MB）
- 限制：WebSocket 消息大小、内存占用、超时

### kubectl cp 方式

```
客户端 → Next.js API → kubectl cp 命令 → K8s API → Pod 容器
                        ↓ 使用 tar 协议传输
```

- 使用 kubectl cp 命令（底层使用 tar 协议）
- 支持大文件（几百MB、几GB）
- 性能更好，更稳定
- 需要在容器内安装 kubectl 并配置访问权限

## 配置 kubectl cp 支持

### 1. 构建包含 kubectl 的镜像

Dockerfile 已经配置好，会自动安装 kubectl：

```dockerfile
# 安装 kubectl
RUN apk add --no-cache curl && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then ARCH="amd64"; fi && \
    if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi && \
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/${ARCH}/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/kubectl
```

### 2. 配置 RBAC 权限

k8s-deployment.yaml 已经包含必要的 RBAC 配置：

```yaml
# ServiceAccount
apiVersion: v1
kind: ServiceAccount
metadata:
  name: xuanwu-factory-next-sa
  namespace: xuanwu-factory

# ClusterRole - 定义所需权限
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: xuanwu-factory-pod-exec
rules:
- apiGroups: [""]
  resources: ["pods", "pods/exec"]
  verbs: ["get", "list", "create"]

# ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: xuanwu-factory-next-pod-exec
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: xuanwu-factory-pod-exec
subjects:
- kind: ServiceAccount
  name: xuanwu-factory-next-sa
  namespace: xuanwu-factory
```

### 3. 部署应用

```bash
# 1. 构建镜像
docker build -t nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next:latest .

# 2. 推送镜像
docker push nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next:latest

# 3. 应用配置（包含 RBAC）
kubectl apply -f k8s-deployment.yaml

# 4. 重启 Pod
kubectl rollout restart deployment xuanwu-factory-next -n xuanwu-factory
```

### 4. 验证配置

进入 Pod 验证 kubectl 是否可用：

```bash
# 进入 Pod
kubectl exec -it deployment/xuanwu-factory-next -n xuanwu-factory -- sh

# 检查 kubectl
kubectl version --client

# 检查集群连接
kubectl cluster-info

# 检查权限
kubectl auth can-i get pods
kubectl auth can-i create pods/exec
```

## 自动降级策略

应用会自动选择最佳上传方式：

1. **大文件（> 10MB）**：
   - kubectl 可用 → 使用 kubectl cp ✅
   - kubectl 不可用 → 返回错误，提示配置 kubectl ❌

2. **小文件（< 10MB）**：
   - kubectl 可用 → 使用 kubectl cp（更快）✅
   - kubectl 不可用 → 降级到 WebSocket exec ✅

3. **超大文件（> 50MB）**：
   - kubectl 可用 → 使用 kubectl cp ✅
   - kubectl 不可用 → 返回错误 ❌

## 监控和日志

查看上传日志：

```bash
kubectl logs -f deployment/xuanwu-factory-next -n xuanwu-factory | grep -E "\[FileUpload\]|\[KubectlFS\]|\[PodFS\]"
```

日志示例：

```
[FileUpload] kubectl 可用性: ✅ 可用
[FileUpload] 开始上传: serviceId=xxx, path=/app, fileName=large.zip, size=150MB
[FileUpload] 大文件（150MB），使用 kubectl cp 方式上传
[KubectlFS] 开始上传: /app/large.zip, 大小: 150MB
[KubectlFS] 临时文件已创建: /tmp/upload-xxx-large.zip
[KubectlFS] 执行命令: kubectl cp /tmp/upload-xxx-large.zip xuanwu-factory/pod-name:/app/large.zip
[KubectlFS] 上传完成: /app/large.zip, 耗时: 3500ms
[FileUpload] 上传成功: /app/large.zip
```

## 故障排查

### kubectl 不可用

**症状**：
```
[KubectlFS] kubectl 不可用: Error: Command failed: kubectl version --client
/bin/sh: kubectl: not found
```

**解决**：
1. 确认镜像包含 kubectl：`kubectl exec -it pod-name -- which kubectl`
2. 重新构建镜像

### kubectl 无法连接集群

**症状**：
```
[KubectlFS] kubectl 已安装但无法连接到集群
```

**解决**：
1. 检查 ServiceAccount 是否配置：`kubectl get sa xuanwu-factory-next-sa -n xuanwu-factory`
2. 检查 RBAC 权限：`kubectl get clusterrolebinding xuanwu-factory-next-pod-exec`
3. 确认 Pod 使用了正确的 ServiceAccount：`kubectl get pod -n xuanwu-factory -o yaml | grep serviceAccountName`

### kubectl cp 权限不足

**症状**：
```
Error from server (Forbidden): pods "xxx" is forbidden
```

**解决**：
1. 检查 ClusterRole 权限：`kubectl get clusterrole xuanwu-factory-pod-exec -o yaml`
2. 确认包含 `pods/exec` 权限
3. 重新应用 RBAC 配置：`kubectl apply -f k8s-deployment.yaml`

## 性能对比

| 文件大小 | WebSocket exec | kubectl cp |
|---------|---------------|-----------|
| 1MB | ~500ms | ~200ms |
| 10MB | ~3s | ~800ms |
| 50MB | ~15s | ~3s |
| 100MB | ❌ 不支持 | ~6s |
| 500MB | ❌ 不支持 | ~30s |

## 安全考虑

1. **最小权限原则**：ServiceAccount 仅授予必要的 `pods/exec` 权限
2. **命名空间隔离**：可以将 ClusterRole 改为 Role，限制在特定命名空间
3. **审计日志**：所有 kubectl 操作都会记录在 K8s 审计日志中
4. **临时文件清理**：上传完成后自动删除临时文件

## 未来优化

- [ ] 支持分片上传（超大文件）
- [ ] 支持断点续传
- [ ] 支持上传进度显示
- [ ] 支持并发上传多个文件
