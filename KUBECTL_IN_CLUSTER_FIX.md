# kubectl 容器内可用性修复

## 问题描述

部署后，服务详情页的文件上传功能报错：
```
[FileUpload] kubectl 可用性: ❌ 不可用
[KubectlFS] kubectl 不可用: Error: Command failed: kubectl version --client --output=json
/bin/sh: kubectl: not found
```

虽然 Dockerfile 中已经安装了 kubectl，但容器内的 kubectl 无法连接到 K8s 集群。

## 根本原因

kubectl 需要配置才能访问 K8s API Server。在容器内运行时，需要使用 **in-cluster 认证**方式，利用 ServiceAccount 的 token 和证书。

## 解决方案

### 1. Dockerfile 修改

为 nextjs 用户创建 `.kube` 目录：

```dockerfile
# 配置 kubectl 使用 in-cluster 认证
# 创建 .kube 目录并设置权限
RUN mkdir -p /home/nextjs/.kube && \
    chown -R nextjs:nodejs /home/nextjs/.kube
```

### 2. 启动脚本修改 (start-servers.sh)

在容器启动时自动配置 kubectl：

```bash
# 配置 kubectl 使用 in-cluster 认证
if [ -f /var/run/secrets/kubernetes.io/serviceaccount/token ]; then
  KUBE_TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  KUBE_CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  
  kubectl config set-cluster kubernetes \
    --server=https://kubernetes.default.svc \
    --certificate-authority=$KUBE_CA
  
  kubectl config set-credentials serviceaccount \
    --token=$KUBE_TOKEN
  
  kubectl config set-context default \
    --cluster=kubernetes \
    --user=serviceaccount
  
  kubectl config use-context default
fi
```

### 3. 优化健康检查

将 `kubectl cluster-info` 改为更轻量的 `kubectl get --raw /healthz`，减少超时风险。

## 验证步骤

### 1. 重新构建镜像

```bash
docker build -t xuanwu-factory-next:latest .
```

### 2. 推送到镜像仓库

```bash
docker tag xuanwu-factory-next:latest nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next:dev-latest
docker push nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next:dev-latest
```

### 3. 更新 K8s 部署

```bash
kubectl set image deployment/xuanwu-factory-next \
  xuanwu-factory-next=nexus.aimstek.cn/xuanwu-factory/xuanwu-factory-next:dev-latest \
  -n xuanwu-factory
```

### 4. 验证 kubectl 可用性

进入 Pod 验证：

```bash
# 进入 Pod
kubectl exec -it deployment/xuanwu-factory-next -n xuanwu-factory -- sh

# 检查 kubectl 配置
kubectl config view

# 测试 kubectl 连接
kubectl get --raw /healthz

# 测试 kubectl 权限
kubectl get pods -n xuanwu-factory
```

### 5. 测试文件上传

在服务详情页上传文件，查看日志：

```
[FileUpload] kubectl 可用性: ✅ 可用
[FileUpload] 开始上传: serviceId=xxx, path=/app, fileName=test.txt, size=15.15KB
[FileUpload] 使用 kubectl cp 方式上传
[KubectlFS] 上传完成: /app/test.txt, 耗时: 234ms
```

## 技术细节

### in-cluster 认证原理

当 Pod 使用 ServiceAccount 时，K8s 会自动挂载以下文件到容器：

- `/var/run/secrets/kubernetes.io/serviceaccount/token` - JWT token
- `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt` - CA 证书
- `/var/run/secrets/kubernetes.io/serviceaccount/namespace` - 命名空间

kubectl 可以使用这些文件来认证和访问 K8s API。

### RBAC 权限

k8s-deployment.yaml 中已配置的权限：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: xuanwu-factory-pod-exec
rules:
- apiGroups: [""]
  resources: ["pods", "pods/exec"]
  verbs: ["get", "list", "create"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]
```

这些权限足够支持 kubectl cp 操作。

## 故障排查

### 如果 kubectl 仍然不可用

1. **检查 ServiceAccount 是否正确挂载**：
   ```bash
   kubectl exec -it deployment/xuanwu-factory-next -n xuanwu-factory -- ls -la /var/run/secrets/kubernetes.io/serviceaccount/
   ```

2. **检查 RBAC 权限**：
   ```bash
   kubectl auth can-i get pods --as=system:serviceaccount:xuanwu-factory:xuanwu-factory-next-sa
   ```

3. **查看 Pod 日志**：
   ```bash
   kubectl logs deployment/xuanwu-factory-next -n xuanwu-factory
   ```

4. **手动测试 kubectl**：
   ```bash
   kubectl exec -it deployment/xuanwu-factory-next -n xuanwu-factory -- kubectl get pods -n xuanwu-factory
   ```

## 总结

通过配置 kubectl 使用 in-cluster 认证，容器内的 kubectl 可以利用 ServiceAccount 的权限访问 K8s API，从而实现高性能的文件上传功能。
