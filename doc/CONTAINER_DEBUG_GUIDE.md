# 容器调试能力增强指南

## 概述

本文档介绍如何在 Kubernetes 环境中调试 xuanwu-factory-next 容器，提供多种调试方案和最佳实践。

---

## 方案 1: 内置调试工具（已集成）

### 已安装的工具

Dockerfile 中已集成以下调试工具：

- **网络工具**: `curl`, `wget`, `netcat`, `nslookup`, `dig`, `tcpdump`
- **进程工具**: `ps`, `top`, `htop`, `strace`
- **文本编辑**: `vim`
- **Kubernetes**: `kubectl`
- **其他**: `busybox-extras`（包含大量 Unix 工具）

### 使用方法

```bash
# 进入容器
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh

# 测试网络连接
curl -v http://example.com
wget -O- http://example.com

# DNS 查询
nslookup xuanwu-factory-next
dig xuanwu-factory-next.xuanwu-factory.svc.cluster.local

# 查看进程
ps aux
htop

# 网络监听
netcat -l -p 8080

# 抓包分析
tcpdump -i any port 3000

# 系统调用跟踪
strace -p <pid>

# 查看 Kubernetes 资源（需要 RBAC 权限）
kubectl get pods -n xuanwu-factory
```

---

## 方案 2: Ephemeral Debug Container（推荐）

### 适用场景

- 需要完整的调试环境但不想修改镜像
- 临时调试，不影响生产环境
- 需要特定的调试工具（如 gdb, perf 等）

### 使用方法

#### 2.1 使用 busybox 调试容器

```bash
# 注入 busybox 调试容器
kubectl debug -it -n xuanwu-factory \
  deployment/xuanwu-factory-next \
  --image=busybox:latest \
  --target=xuanwu-factory-next \
  --share-processes

# 在调试容器中可以看到主容器的进程
ps aux
```

#### 2.2 使用完整 Linux 发行版

```bash
# 使用 Ubuntu 调试容器（包含完整工具集）
kubectl debug -it -n xuanwu-factory \
  deployment/xuanwu-factory-next \
  --image=ubuntu:22.04 \
  --target=xuanwu-factory-next \
  --share-processes

# 安装需要的工具
apt-get update
apt-get install -y curl wget netcat dnsutils tcpdump strace
```

#### 2.3 使用 nicolaka/netshoot（网络调试专用）

```bash
# 最强大的网络调试工具集
kubectl debug -it -n xuanwu-factory \
  deployment/xuanwu-factory-next \
  --image=nicolaka/netshoot \
  --target=xuanwu-factory-next

# netshoot 包含的工具：
# - tcpdump, wireshark, tshark
# - nmap, netcat, socat
# - curl, wget, httpie
# - dig, nslookup, host
# - iperf, iperf3
# - mtr, traceroute
# - 等等...
```

#### 2.4 复制文件系统进行调试

```bash
# 创建一个副本容器进行调试（不影响运行中的容器）
kubectl debug -it -n xuanwu-factory \
  deployment/xuanwu-factory-next \
  --image=busybox:latest \
  --copy-to=xuanwu-factory-next-debug

# 调试完成后删除
kubectl delete pod -n xuanwu-factory xuanwu-factory-next-debug
```

---

## 方案 3: Init Container 方案（可选）

### 适用场景

- 需要在主容器启动前准备调试环境
- 需要共享调试工具给多个容器
- 希望保持主镜像精简

### 启用方法

在 `k8s-deployment.yaml` 中已经预留了配置（注释状态），取消注释即可启用：

```yaml
spec:
  volumes:
  - name: debug-tools
    emptyDir: {}
  
  initContainers:
  - name: install-debug-tools
    image: busybox:latest
    command: ['sh', '-c']
    args:
    - |
      echo "Installing debug tools..."
      cp /bin/busybox /debug-tools/
      /debug-tools/busybox --install -s /debug-tools/
      echo "Debug tools installed successfully"
    volumeMounts:
    - name: debug-tools
      mountPath: /debug-tools
  
  containers:
  - name: xuanwu-factory-next
    volumeMounts:
    - name: debug-tools
      mountPath: /debug-tools
```

### 使用方法

```bash
# 进入容器后，调试工具在 /debug-tools 目录
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh

# 使用 init container 安装的工具
/debug-tools/ls -la
/debug-tools/netstat -tulpn
/debug-tools/ps aux

# 或者添加到 PATH
export PATH=/debug-tools:$PATH
ls -la
```

---

## 方案 4: 使用 kubectl port-forward 进行本地调试

### 适用场景

- 需要使用本地工具调试远程服务
- 测试服务端口连通性
- 本地开发环境连接集群服务

### 使用方法

```bash
# 转发 Next.js 服务端口
kubectl port-forward -n xuanwu-factory deployment/xuanwu-factory-next 3000:3000

# 转发 WebSocket 服务端口
kubectl port-forward -n xuanwu-factory deployment/xuanwu-factory-next 3001:3001

# 同时转发多个端口
kubectl port-forward -n xuanwu-factory deployment/xuanwu-factory-next 3000:3000 3001:3001

# 然后在本地访问
curl http://localhost:3000
wscat -c ws://localhost:3001
```

---

## 常见调试场景

### 场景 1: 网络连通性问题

```bash
# 方法 1: 使用内置工具
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh
curl -v http://target-service:port
nslookup target-service

# 方法 2: 使用 netshoot
kubectl debug -it -n xuanwu-factory deployment/xuanwu-factory-next \
  --image=nicolaka/netshoot --target=xuanwu-factory-next
curl -v http://target-service:port
tcpdump -i any port 3000
```

### 场景 2: 进程和性能问题

```bash
# 使用内置工具
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh
ps aux
htop
strace -p <pid>

# 或使用 ephemeral container 获取更多工具
kubectl debug -it -n xuanwu-factory deployment/xuanwu-factory-next \
  --image=ubuntu:22.04 --target=xuanwu-factory-next --share-processes
apt-get update && apt-get install -y strace lsof
```

### 场景 3: 文件系统问题

```bash
# 进入容器检查文件
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh
ls -la /app
cat /app/.env
df -h
du -sh /app/*

# 编辑配置文件（临时修改，重启后失效）
vim /app/config.json
```

### 场景 4: 数据库连接问题

```bash
# 测试数据库连接
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh

# 使用 netcat 测试端口
nc -zv 192.168.154.154 3306

# 使用 curl 测试 HTTP 服务
curl -v http://192.168.44.121

# 查看 DNS 解析
nslookup 192.168.154.154
```

### 场景 5: 日志和环境变量

```bash
# 查看实时日志
kubectl logs -f -n xuanwu-factory deployment/xuanwu-factory-next

# 查看环境变量
kubectl exec -n xuanwu-factory deployment/xuanwu-factory-next -- env

# 查看特定环境变量
kubectl exec -n xuanwu-factory deployment/xuanwu-factory-next -- sh -c 'echo $DATABASE_URL'
```

---

## 最佳实践

### 1. 生产环境调试原则

- ✅ 优先使用 Ephemeral Container，不修改运行中的容器
- ✅ 使用 `--copy-to` 创建副本进行破坏性调试
- ✅ 调试完成后及时清理临时资源
- ❌ 避免在生产容器中安装过多调试工具
- ❌ 不要在生产环境中使用 `--privileged` 模式

### 2. 镜像大小优化

当前方案添加的调试工具约增加 **50-80MB** 镜像大小，这是可接受的。如果需要进一步优化：

```dockerfile
# 创建精简版（生产）和调试版（开发）两个镜像
FROM node:20-alpine AS runner-base
# ... 基础配置 ...

# 生产版本（精简）
FROM runner-base AS runner-prod
RUN apk add --no-cache ca-certificates curl tzdata kubectl

# 调试版本（完整工具）
FROM runner-base AS runner-debug
RUN apk add --no-cache \
    ca-certificates curl wget tzdata kubectl \
    busybox-extras bind-tools netcat-openbsd \
    tcpdump strace procps htop vim

# 根据构建参数选择
ARG BUILD_TYPE=prod
FROM runner-${BUILD_TYPE} AS runner
```

### 3. 安全考虑

- 调试工具可能引入安全风险，建议：
  - 生产环境使用精简镜像 + Ephemeral Container
  - 开发/测试环境使用完整调试工具镜像
  - 定期更新基础镜像和工具版本
  - 使用非 root 用户运行（已配置）

### 4. 推荐工具集

根据不同场景选择合适的调试镜像：

| 场景 | 推荐镜像 | 说明 |
|------|---------|------|
| 网络调试 | `nicolaka/netshoot` | 最全面的网络工具集 |
| 轻量调试 | `busybox:latest` | 体积小，基础工具齐全 |
| 完整环境 | `ubuntu:22.04` | 可安装任何工具 |
| Alpine 兼容 | `alpine:latest` | 与主容器环境一致 |

---

## 快速参考命令

```bash
# 进入容器 shell
kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh

# 注入调试容器（网络工具）
kubectl debug -it -n xuanwu-factory deployment/xuanwu-factory-next \
  --image=nicolaka/netshoot --target=xuanwu-factory-next

# 查看日志
kubectl logs -f -n xuanwu-factory deployment/xuanwu-factory-next

# 端口转发
kubectl port-forward -n xuanwu-factory deployment/xuanwu-factory-next 3000:3000

# 查看资源使用
kubectl top pod -n xuanwu-factory

# 查看事件
kubectl get events -n xuanwu-factory --sort-by='.lastTimestamp'

# 描述 Pod 详情
kubectl describe pod -n xuanwu-factory -l app=xuanwu-factory-next
```

---

## 故障排查流程

1. **查看 Pod 状态**
   ```bash
   kubectl get pods -n xuanwu-factory
   ```

2. **查看日志**
   ```bash
   kubectl logs -n xuanwu-factory deployment/xuanwu-factory-next --tail=100
   ```

3. **检查事件**
   ```bash
   kubectl describe pod -n xuanwu-factory <pod-name>
   ```

4. **进入容器调试**
   ```bash
   kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- sh
   ```

5. **网络测试**
   ```bash
   kubectl debug -it -n xuanwu-factory deployment/xuanwu-factory-next \
     --image=nicolaka/netshoot --target=xuanwu-factory-next
   ```

6. **性能分析**
   ```bash
   kubectl top pod -n xuanwu-factory
   kubectl exec -it -n xuanwu-factory deployment/xuanwu-factory-next -- htop
   ```

---

## 总结

本方案采用 **内置轻量工具 + Ephemeral Container** 的组合策略：

- ✅ Dockerfile 中集成常用调试工具（约 50-80MB）
- ✅ 需要深度调试时使用 Ephemeral Container 注入专用工具
- ✅ 保留 Init Container 方案作为备选（注释状态）
- ✅ 提供完整的调试场景和最佳实践

这种方案在镜像大小、调试能力和安全性之间取得了良好平衡。
