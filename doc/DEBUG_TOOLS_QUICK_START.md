# 调试工具功能快速上手指南

## 功能概述

在服务配置页面中，可以为容器注入调试工具，无需修改原始镜像，方便快速排查问题。

---

## 使用步骤

### 1. 启用调试工具

1. 进入服务详情页 → **配置** 标签页
2. 滚动到 **调试工具** 部分
3. 点击 **编辑配置** 按钮
4. 打开 **启用调试工具** 开关

### 2. 选择工具集

根据调试需求选择合适的工具集：

#### 🔧 BusyBox（推荐）
- **大小**: ~5MB
- **适用**: 日常调试、快速排查
- **包含工具**: ls, ps, netstat, wget, nc, vi, top 等
- **推荐指数**: ⭐⭐⭐⭐⭐

#### 🌐 Netshoot
- **大小**: ~300MB
- **适用**: 网络问题深度调试
- **包含工具**: tcpdump, nmap, curl, dig, iperf3, mtr, traceroute 等
- **推荐指数**: ⭐⭐⭐⭐

#### 🐧 Ubuntu
- **大小**: ~80MB
- **适用**: 需要完整 Linux 环境或特定工具
- **包含工具**: bash, curl, wget, ps, apt-get 等
- **推荐指数**: ⭐⭐⭐

#### 🎨 自定义镜像
- **大小**: 取决于镜像
- **适用**: 特殊需求
- **推荐指数**: ⭐⭐

### 3. 保存并部署

1. 点击 **保存** 按钮
2. 点击 **部署** 按钮
3. 等待部署完成

---

## 使用调试工具

### 方式一：进入容器使用

```bash
# 1. 进入容器
kubectl exec -it <pod-name> -n <namespace> -- sh

# 2. 直接使用工具（完整路径）
/debug-tools/ls -la
/debug-tools/ps aux
/debug-tools/netstat -tulpn
/debug-tools/curl http://example.com
```

### 方式二：添加到 PATH（推荐）

```bash
# 1. 进入容器
kubectl exec -it <pod-name> -n <namespace> -- sh

# 2. 添加到 PATH
export PATH=/debug-tools:$PATH

# 3. 直接使用工具
ls -la
ps aux
netstat -tulpn
curl http://example.com
```

### 方式三：通过平台 Web Terminal

1. 在服务详情页点击 **终端** 标签
2. 自动进入容器
3. 执行 `export PATH=/debug-tools:$PATH`
4. 使用调试工具

---

## 常见调试场景

### 场景 1: 检查网络连通性

```bash
# 测试 HTTP 连接
/debug-tools/curl -v http://target-service:port

# 测试端口连通性
/debug-tools/nc -zv target-service port

# DNS 查询
/debug-tools/nslookup target-service
```

### 场景 2: 查看进程和端口

```bash
# 查看所有进程
/debug-tools/ps aux

# 查看监听端口
/debug-tools/netstat -tulpn

# 实时监控进程
/debug-tools/top
```

### 场景 3: 下载和上传文件

```bash
# 下载文件
/debug-tools/wget http://example.com/file.txt

# 查看文件内容
/debug-tools/cat file.txt

# 编辑文件
/debug-tools/vi config.txt
```

### 场景 4: 网络抓包（Netshoot）

```bash
# 抓取 HTTP 流量
/debug-tools/bin/tcpdump -i any port 80 -w capture.pcap

# 实时查看流量
/debug-tools/bin/tcpdump -i any port 80 -A
```

---

## 工具列表

### BusyBox 包含的工具

```
ls, cat, cp, mv, rm, mkdir, rmdir, touch, chmod, chown
ps, top, kill, pidof
netstat, ping, wget, nc (netcat), telnet
vi, grep, sed, awk, find
tar, gzip, gunzip
df, du, mount, umount
echo, printf, test
sh (shell)
```

### Netshoot 包含的工具

```
网络诊断: ping, traceroute, mtr, nslookup, dig, host
网络工具: curl, wget, httpie, netcat, socat
抓包分析: tcpdump, tshark, wireshark
性能测试: iperf, iperf3, ab (Apache Bench)
扫描工具: nmap, masscan
其他: ssh, telnet, ftp, rsync
```

### Ubuntu 包含的工具

```
基础工具: bash, sh, ls, cat, grep, ps, top
网络工具: curl, wget, netcat, ping
包管理: apt-get, dpkg
开发工具: 可通过 apt-get 安装任何工具
```

---

## 注意事项

### 1. 性能影响

- Init Container 只在 Pod 启动时运行一次
- 工具存储在 emptyDir 卷中，占用节点存储
- BusyBox 仅占用 ~5MB，对性能影响极小

### 2. 安全考虑

- 调试工具仅在容器内部可用
- 不会修改原始镜像
- 建议在开发/测试环境使用
- 生产环境按需启用

### 3. 镜像拉取策略

**自动优化**:
- 系统使用 `IfNotPresent` 策略，优先使用本地缓存
- 如果节点上已有镜像，不会重复拉取
- 首次使用时会从镜像仓库拉取

**加速部署**（可选）:
```bash
# 方式 1: 手动在节点上预拉取镜像
docker pull busybox:latest
docker pull nicolaka/netshoot:latest
docker pull ubuntu:22.04

# 方式 2: 使用 DaemonSet 自动在所有节点拉取
kubectl apply -f k8s/debug-tools-image-puller.yaml

# 查看拉取状态
kubectl get pods -n debug-tools -o wide
```

**镜像列表**:
- BusyBox: `busybox:latest` (~5MB)
- Netshoot: `nicolaka/netshoot:latest` (~300MB)
- Ubuntu: `ubuntu:22.04` (~80MB)

### 4. 工具路径

- 默认挂载路径: `/debug-tools`
- BusyBox: 工具直接在 `/debug-tools/` 下
- Netshoot/Ubuntu: 工具在 `/debug-tools/bin/` 下

---

## 故障排查

### 问题 1: 工具不可用

**症状**: 执行 `/debug-tools/ls` 提示 "not found"

**解决方案**:
```bash
# 检查工具是否安装
ls -la /debug-tools/

# 如果目录为空，查看 Init Container 日志
kubectl logs <pod-name> -n <namespace> -c install-debug-tools
```

### 问题 2: Init Container 失败

**症状**: Pod 一直处于 Init 状态

**解决方案**:
```bash
# 查看 Init Container 日志
kubectl logs <pod-name> -n <namespace> -c install-debug-tools

# 查看 Pod 事件
kubectl describe pod <pod-name> -n <namespace>

# 常见原因：镜像拉取失败，检查网络和镜像地址
```

### 问题 3: 权限问题

**症状**: 执行工具提示 "Permission denied"

**解决方案**:
```bash
# 检查文件权限
ls -la /debug-tools/

# 添加执行权限
chmod +x /debug-tools/*

# 或使用完整路径
sh /debug-tools/ls -la
```

---

## 最佳实践

### 1. 选择合适的工具集

- **日常调试**: 使用 BusyBox，体积小、速度快
- **网络问题**: 使用 Netshoot，工具最全面
- **需要特定工具**: 使用 Ubuntu，可 apt-get 安装

### 2. 添加到 PATH

在容器启动脚本或 `.bashrc` 中添加：

```bash
export PATH=/debug-tools:$PATH
```

### 3. 创建别名

```bash
alias ll='/debug-tools/ls -la'
alias psg='/debug-tools/ps aux | /debug-tools/grep'
```

### 4. 生产环境使用

- 仅在需要时临时启用
- 调试完成后禁用并重新部署
- 或使用 Ephemeral Container（K8s 1.23+）

---

## 高级用法

### 1. 自定义工具集

创建自己的调试工具镜像：

```dockerfile
FROM alpine:latest

RUN apk add --no-cache \
    curl \
    wget \
    netcat-openbsd \
    bind-tools \
    your-custom-tool

# 复制工具到 /tools 目录
RUN mkdir -p /tools && \
    cp /usr/bin/curl /tools/ && \
    cp /usr/bin/wget /tools/
```

在配置中选择"自定义镜像"，填入镜像地址。

### 2. 持久化工具

如果需要在多个容器间共享工具，可以使用 PVC：

```yaml
# 修改 debug_config
{
  "enabled": true,
  "toolset": "busybox",
  "mountPath": "/debug-tools",
  "persistent": true  # 自定义扩展
}
```

### 3. 与 CI/CD 集成

在 Jenkins 或 GitLab CI 中自动启用调试工具：

```bash
# 部署前启用调试工具
curl -X PATCH http://api/services/${SERVICE_ID} \
  -H "Content-Type: application/json" \
  -d '{"debug_config": {"enabled": true, "toolset": "busybox", "mountPath": "/debug-tools"}}'

# 部署
curl -X POST http://api/services/${SERVICE_ID}/deploy
```

---

## 总结

调试工具功能通过 Init Container 的方式，在不修改原始镜像的前提下，为容器提供灵活的调试能力。选择合适的工具集，可以大大提升问题排查效率。

**推荐配置**:
- 开发环境: BusyBox（默认启用）
- 测试环境: BusyBox 或 Netshoot
- 生产环境: 按需启用或使用 Ephemeral Container
