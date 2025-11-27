# Prometheus 监控配置部署指南

**文档版本**: 1.0  
**更新时间**: 2025-11-27

---

## 环境变量说明

### PROMETHEUS_URL

用于配置 Prometheus 服务的访问地址，应用通过此地址查询历史监控数据。

**变量名**: `PROMETHEUS_URL`  
**是否必需**: 可选（如果不配置，资源使用趋势功能将不可用）  
**默认值**: `http://prometheus.dev.aimstek.cn`

---

## 部署到 Kubernetes

### 方式1：使用外部域名（推荐）

使用统一的外部域名访问 Prometheus：

```yaml
# k8s-deployment.yaml - Secret 部分
apiVersion: v1
kind: Secret
metadata:
  name: xuanwu-factory-secret
  namespace: xuanwu-factory
type: Opaque
stringData:
  # Prometheus 配置（默认）
  PROMETHEUS_URL: "http://prometheus.dev.aimstek.cn"
```

**优点**:
- 统一的访问地址，便于管理
- 不依赖集群内部服务发现
- 可以跨集群访问

### 方式2：使用集群内部服务名

如果 Prometheus 部署在同一个 Kubernetes 集群中，也可以使用集群内部服务名：

```yaml
stringData:
  # Prometheus 配置
  PROMETHEUS_URL: "http://prometheus-k8s.kuboard:9090"
```

**常见的 Prometheus 服务名格式**:
- `http://prometheus-k8s.<namespace>:9090`
- `http://prometheus-k8s.<namespace>.svc.cluster.local:9090`
- `http://prometheus-server.<namespace>:9090`

**如何查找 Prometheus 服务名**:
```bash
# 查找 Prometheus 服务
kubectl get svc -A | grep prometheus

# 示例输出:
# kuboard       prometheus-k8s       ClusterIP   10.96.0.225   <none>        9090/TCP    37d
# monitoring    prometheus-server    ClusterIP   10.96.1.100   <none>        9090/TCP    60d
```

根据输出结果，服务地址为：
- `http://prometheus-k8s.kuboard:9090`
- `http://prometheus-server.monitoring:9090`

---

### 方式3：使用完整的集群内部地址

使用完整的 FQDN（Fully Qualified Domain Name）：

```yaml
stringData:
  PROMETHEUS_URL: "http://prometheus-k8s.monitoring.svc.cluster.local:9090"
```

**格式**: `http://<service-name>.<namespace>.svc.cluster.local:<port>`

---

## 配置步骤

### 1. 更新 Secret

编辑 `k8s-deployment.yaml` 文件，在 Secret 部分添加 Prometheus 配置：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: xuanwu-factory-secret
  namespace: xuanwu-factory
type: Opaque
stringData:
  # ... 其他配置 ...
  
  # Prometheus 配置
  PROMETHEUS_URL: "http://prometheus-k8s.kuboard:9090"
  
  # Grafana 配置（可选）
  NEXT_PUBLIC_GRAFANA_URL: "http://grafana.yourdomain.com"
```

### 2. 应用配置

```bash
# 应用 Secret 配置
kubectl apply -f k8s-deployment.yaml

# 或者只更新 Secret
kubectl create secret generic xuanwu-factory-secret \
  --from-literal=PROMETHEUS_URL="http://prometheus-k8s.kuboard:9090" \
  --namespace=xuanwu-factory \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 3. 重启应用

```bash
# 重启 Deployment 以应用新的环境变量
kubectl rollout restart deployment/xuanwu-factory -n xuanwu-factory

# 查看重启状态
kubectl rollout status deployment/xuanwu-factory -n xuanwu-factory
```

### 4. 验证配置

```bash
# 查看 Pod 环境变量
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- env | grep PROMETHEUS

# 测试 Prometheus 连接
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- \
  curl -s "http://prometheus-k8s.kuboard:9090/api/v1/query?query=up" | head -20
```

---

## 不同环境的配置示例

### 开发环境

```yaml
stringData:
  PROMETHEUS_URL: "http://prometheus.dev.aimstek.cn"
  NEXT_PUBLIC_GRAFANA_URL: "http://192.168.44.201:32550"
```

### 测试环境

```yaml
stringData:
  PROMETHEUS_URL: "http://prometheus.test.aimstek.cn"
  NEXT_PUBLIC_GRAFANA_URL: "http://grafana.test.aimstek.cn"
```

### 生产环境

```yaml
stringData:
  PROMETHEUS_URL: "http://prometheus.prod.aimstek.cn"
  NEXT_PUBLIC_GRAFANA_URL: "https://grafana.aimstek.cn"
```

---

## 网络访问要求

### 集群内部访问

应用 Pod 需要能够访问 Prometheus 服务：

```bash
# 测试网络连通性
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- \
  curl -v -m 5 "http://prometheus.dev.aimstek.cn/api/v1/query?query=up"
```

**可能的问题**:
1. **DNS 解析失败**: 检查 CoreDNS 是否正常
2. **网络策略限制**: 检查 NetworkPolicy 配置
3. **服务不存在**: 确认 Prometheus 服务名和命名空间

### 外部访问

如果使用外部域名，确保：
1. DNS 解析正常
2. 防火墙允许访问
3. 网络路由正确

---

## 故障排查

### 问题1: 资源使用趋势显示"暂无数据"

**可能原因**:
- Prometheus URL 配置错误
- 网络不通
- Prometheus 中没有对应的监控数据

**排查步骤**:
```bash
# 1. 检查环境变量
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- env | grep PROMETHEUS_URL

# 2. 测试连接
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- \
  curl -s "http://prometheus-k8s.kuboard:9090/api/v1/query?query=up"

# 3. 查看应用日志
kubectl logs -n xuanwu-factory deployment/xuanwu-factory | grep "Metrics History"

# 4. 测试具体查询
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- \
  curl -s "http://prometheus-k8s.kuboard:9090/api/v1/query_range?query=container_cpu_usage_seconds_total&start=$(date -u -v-1H +%s)&end=$(date -u +%s)&step=30s"
```

### 问题2: API 返回 500 错误

**可能原因**:
- Prometheus 服务不可访问
- 查询语法错误
- 超时

**解决方法**:
```bash
# 查看详细错误日志
kubectl logs -n xuanwu-factory deployment/xuanwu-factory --tail=100 | grep -A 10 "Metrics History"

# 检查 Prometheus 状态
kubectl get pods -n kuboard -l app.kubernetes.io/name=prometheus
```

### 问题3: 环境变量未生效

**可能原因**:
- Secret 未更新
- Pod 未重启

**解决方法**:
```bash
# 1. 确认 Secret 已更新
kubectl get secret xuanwu-factory-secret -n xuanwu-factory -o yaml | grep PROMETHEUS_URL

# 2. 强制重启 Pod
kubectl rollout restart deployment/xuanwu-factory -n xuanwu-factory

# 3. 等待 Pod 就绪
kubectl rollout status deployment/xuanwu-factory -n xuanwu-factory

# 4. 验证环境变量
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- env | grep PROMETHEUS_URL
```

---

## 安全建议

### 1. 使用集群内部访问

优先使用集群内部服务名，避免暴露 Prometheus 到公网：

```yaml
# ✅ 推荐
PROMETHEUS_URL: "http://prometheus-k8s.kuboard:9090"

# ❌ 不推荐（除非必要）
PROMETHEUS_URL: "http://public-prometheus.example.com:9090"
```

### 2. 启用认证（如果需要）

如果 Prometheus 启用了认证，可以在 URL 中包含凭据：

```yaml
# 基本认证
PROMETHEUS_URL: "http://username:password@prometheus-k8s.kuboard:9090"

# 或使用 Bearer Token（需要修改代码支持）
```

### 3. 使用 HTTPS

生产环境建议使用 HTTPS：

```yaml
PROMETHEUS_URL: "https://prometheus.yourdomain.com"
```

### 4. 网络策略

配置 NetworkPolicy 限制访问：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: xuanwu-factory-egress
  namespace: xuanwu-factory
spec:
  podSelector:
    matchLabels:
      app: xuanwu-factory
  policyTypes:
  - Egress
  egress:
  # 允许访问 Prometheus
  - to:
    - namespaceSelector:
        matchLabels:
          name: kuboard
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: prometheus
    ports:
    - protocol: TCP
      port: 9090
```

---

## 性能优化

### 1. 使用集群内部地址

集群内部访问延迟更低：

```yaml
# 延迟: ~1-5ms
PROMETHEUS_URL: "http://prometheus-k8s.kuboard:9090"

# 延迟: ~10-50ms（取决于网络）
PROMETHEUS_URL: "http://prometheus.external.com:9090"
```

### 2. 配置超时

在代码中已配置 10 秒超时：

```typescript
const response = await fetch(url.toString(), {
  method: 'GET',
  headers: { 'Accept': 'application/json' },
  signal: AbortSignal.timeout(10000) // 10秒超时
})
```

### 3. 监控查询性能

```bash
# 查看 API 响应时间
kubectl logs -n xuanwu-factory deployment/xuanwu-factory | \
  grep "Metrics History" | \
  grep -E "查询|返回"
```

---

## 环境变量完整列表

| 变量名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `PROMETHEUS_URL` | string | 否 | `http://prometheus-k8s.kuboard:9090` | Prometheus 服务地址 |
| `NEXT_PUBLIC_GRAFANA_URL` | string | 否 | - | Grafana 服务地址（前端可见） |

**注意**:
- `PROMETHEUS_URL`: 后端使用，不会暴露到前端
- `NEXT_PUBLIC_GRAFANA_URL`: 前端使用，会暴露到浏览器

---

## 相关文档

- [Prometheus 查询 API 文档](https://prometheus.io/docs/prometheus/latest/querying/api/)
- [Kubernetes Service DNS](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [资源监控 UI 优化报告](./METRICS_UI_OPTIMIZATION.md)
- [Step 自动优化文档](./METRICS_STEP_OPTIMIZATION.md)

---

## 总结

### 推荐配置（Kubernetes 部署）

```yaml
# Secret 配置
stringData:
  # 使用外部域名（默认）
  PROMETHEUS_URL: "http://prometheus.dev.aimstek.cn"
  
  # 可选：Grafana 地址
  NEXT_PUBLIC_GRAFANA_URL: "http://grafana.yourdomain.com"
```

### 部署命令

```bash
# 1. 更新配置
kubectl apply -f k8s-deployment.yaml

# 2. 重启应用
kubectl rollout restart deployment/xuanwu-factory -n xuanwu-factory

# 3. 验证
kubectl exec -n xuanwu-factory deployment/xuanwu-factory -- \
  curl -s "http://prometheus.dev.aimstek.cn/api/v1/query?query=up" | jq -r '.status'
```

### 快速测试

```bash
# 测试脚本
./scripts/test-prometheus-query.sh xuanwu-factory elasticsearch
```

---

**文档维护**: 如有问题或建议，请联系开发团队  
**最后更新**: 2025-11-27
