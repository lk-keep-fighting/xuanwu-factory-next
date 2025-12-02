# Kubernetes 配置文件

## 文件列表

### debug-tools-image-puller.yaml

调试工具镜像预拉取器，用于在所有节点上预先拉取调试工具镜像。

**功能**:
- 在所有 Kubernetes 节点上预拉取 BusyBox、Netshoot、Ubuntu 镜像
- 加快服务部署速度
- 减少镜像拉取失败的风险

**部署**:
```bash
# 部署 DaemonSet
kubectl apply -f k8s/debug-tools-image-puller.yaml

# 查看状态
kubectl get daemonset -n debug-tools
kubectl get pods -n debug-tools -o wide

# 查看日志
kubectl logs -n debug-tools -l app=debug-tools-image-puller
```

**验证**:
```bash
# 在任意节点上检查镜像
docker images | grep -E "busybox|netshoot|ubuntu"
```

**更新镜像**:
```bash
# 重启 DaemonSet 以拉取最新镜像
kubectl rollout restart daemonset/debug-tools-image-puller -n debug-tools
```

**卸载**:
```bash
# 删除所有资源
kubectl delete namespace debug-tools
```

**资源使用**:
- CPU: 每个节点约 10m（运行时）
- 内存: 每个节点约 32Mi（运行时）
- 磁盘: 约 400MB（三个镜像总大小）

**注意事项**:
1. 这个 DaemonSet 会在所有节点上运行
2. 首次部署可能需要一些时间
3. 镜像会占用节点磁盘空间
4. 如果使用私有镜像仓库，需要配置 imagePullSecrets

---

## 相关文档

- [调试工具功能概述](../doc/DEBUG_TOOLS_README.md)
- [快速上手指南](../doc/DEBUG_TOOLS_QUICK_START.md)
- [故障排查指南](../doc/DEBUG_TOOLS_TROUBLESHOOTING.md)
