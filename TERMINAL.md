# Web 终端功能

玄武工厂平台支持通过 Web 浏览器直接进入容器执行命令。

## 功能特性

- ✅ 完整的交互式终端体验
- ✅ 实时命令执行和输出
- ✅ 支持全屏模式
- ✅ 自动适应窗口大小
- ✅ 连接状态监控
- ✅ 支持颜色和格式化输出
- ✅ 可点击的链接识别

## 使用方法

### 1. 进入终端

1. 在服务详情页找到目标服务
2. 确保服务状态为"运行中"
3. 点击"命令行"按钮
4. 等待连接建立

### 2. 终端操作

连接成功后，您将看到一个完整的 shell 环境：

```bash
# 查看当前目录
$ pwd
/app

# 列出文件
$ ls -la

# 查看环境变量
$ env

# 查看进程
$ ps aux

# 编辑文件
$ vi config.yml

# 查看日志
$ tail -f /var/log/app.log
```

### 3. 功能按钮

**返回**：返回服务详情页

**重新连接**：当连接断开时，点击重新建立连接

**全屏/退出全屏**：切换全屏显示模式

## 技术架构

### 自定义 Next.js 服务器

项目使用自定义 Node.js 服务器（`server.js`）来支持 WebSocket 连接：

```javascript
// 启动开发服务器
pnpm dev

// 启动生产服务器
pnpm start

// 使用标准 Next.js（不支持WebSocket）
pnpm dev:next  // 开发
pnpm start:next  // 生产
```

### WebSocket 连接

- **路径**：`ws://localhost:3000/api/services/:serviceId/terminal`
- **协议**：WebSocket
- **消息格式**：JSON

**客户端发送**：
```json
{
  "type": "input",
  "data": "ls\n"
}
```

**服务器响应**：
```json
{
  "type": "output",
  "data": "file1.txt\nfile2.txt\n"
}
```

### Kubernetes Exec

后端通过 Kubernetes Exec API 连接到 Pod 容器：

1. 查询服务对应的 Pod
2. 创建 Exec 会话（`/bin/sh`）
3. 建立双向流式连接
4. 转发 stdin/stdout/stderr

## 配置要求

### 环境变量

终端功能需要正确配置 Kubernetes 访问：

```bash
# 方式 1：使用完整 kubeconfig
KUBECONFIG_DATA="<your-kubeconfig-content>"

# 方式 2：使用 Token（见项目主 README）
K8S_API_SERVER="https://k8s.example.com:6443"
K8S_BEARER_TOKEN="<your-token>"
```

### Kubernetes 权限

需要以下 RBAC 权限：

```yaml
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods/exec"]
  verbs: ["create"]
```

## 常见问题

### Q: 终端无法连接？

**A**: 检查以下项：
1. 服务是否处于"运行中"状态
2. Pod 是否存在且健康
3. Kubernetes 配置是否正确
4. 网络连接是否正常

### Q: 连接成功但无法执行命令？

**A**: 可能原因：
1. 容器中没有 `/bin/sh`（尝试使用 `/bin/bash`）
2. 容器以只读文件系统运行
3. 权限不足

### Q: 终端突然断开？

**A**: 可能原因：
1. Pod 被重启或终止
2. 网络超时（默认30秒心跳）
3. Kubernetes API 连接中断

点击"重新连接"按钮重新建立连接。

### Q: 终端大小调整不生效？

**A**: Kubernetes Exec API 不支持动态调整 TTY 大小。调整浏览器窗口后，终端会自动适应显示区域，但容器内的 `$COLUMNS` 和 `$LINES` 不会改变。

## 安全建议

1. **生产环境**：建议限制终端访问权限
2. **审计日志**：记录所有终端会话和执行的命令
3. **超时控制**：设置会话超时时间
4. **命令限制**：考虑使用受限 shell
5. **HTTPS/WSS**：生产环境必须使用加密连接

## 开发调试

### 查看 WebSocket 日志

服务器端会输出详细的连接日志：

```bash
[Terminal] New connection for service: abc123
[Terminal] Connecting to pod: my-app-xyz, container: app
[Terminal] Resize request: 120x40
[Terminal] Connection closed for service: abc123
```

### 浏览器开发者工具

1. 打开浏览器开发者工具（F12）
2. 切换到"网络"标签
3. 筛选 WS（WebSocket）
4. 查看消息收发详情

## 限制与注意事项

1. **单 Pod 访问**：当前实现默认连接到第一个 Pod
2. **无历史记录**：终端会话不保存历史
3. **无文件上传**：不支持通过终端上传文件
4. **命令限制**：某些交互式命令可能显示异常
5. **性能影响**：大量输出可能影响浏览器性能

## 未来改进

- [ ] 支持选择连接到特定 Pod
- [ ] 支持多标签页（多个终端）
- [ ] 支持复制粘贴
- [ ] 支持会话录制和回放
- [ ] 支持文件上传/下载
- [ ] 支持动态 TTY 大小调整
- [ ] 添加命令审计日志
