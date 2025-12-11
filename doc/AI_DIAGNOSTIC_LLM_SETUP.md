# AI 诊断助手 - 本地 LLM 配置指南

本文档介绍如何配置和部署本地 LLM（大语言模型）以支持 AI 诊断助手功能。

## 目录

- [概述](#概述)
- [方案选择](#方案选择)
- [Ollama 安装与配置](#ollama-安装与配置)
- [OpenAI API 配置](#openai-api-配置)
- [环境变量配置](#环境变量配置)
- [健康检查](#健康检查)
- [故障排查](#故障排查)

## 概述

AI 诊断助手支持两种 LLM 提供商：

1. **Ollama**（推荐）：本地部署，数据安全，无需外部 API
2. **OpenAI API**：云端服务，需要 API Key，响应速度快

### 推荐配置

| 环境 | 推荐方案 | 模型 | 原因 |
|------|---------|------|------|
| 开发环境 | Ollama | qwen2.5:7b | 本地调试，快速迭代 |
| 测试环境 | Ollama | qwen2.5:7b | 与生产环境一致 |
| 生产环境 | Ollama | qwen2.5:14b | 更好的诊断能力 |
| 备选方案 | OpenAI | gpt-4 | 高可用性要求 |

## 方案选择

### Ollama（本地部署）

**优点：**
- ✅ 数据完全本地化，安全性高
- ✅ 无需外部网络依赖
- ✅ 无使用成本
- ✅ 响应延迟可控

**缺点：**
- ❌ 需要 GPU 资源（推荐）
- ❌ 模型能力相对较弱
- ❌ 需要维护和更新

**硬件要求：**
- CPU：4 核以上
- 内存：8GB 以上（7B 模型），16GB 以上（14B 模型）
- GPU：可选，但强烈推荐（NVIDIA GPU，8GB+ 显存）
- 磁盘：10GB 以上（存储模型文件）

### OpenAI API（云端服务）

**优点：**
- ✅ 模型能力强（GPT-4）
- ✅ 无需本地资源
- ✅ 高可用性

**缺点：**
- ❌ 需要外部网络访问
- ❌ 有使用成本
- ❌ 数据传输到外部

## Ollama 安装与配置

### 1. 安装 Ollama

#### Linux / macOS

```bash
# 使用官方安装脚本
curl -fsSL https://ollama.com/install.sh | sh
```

#### macOS（使用 Homebrew）

```bash
brew install ollama
```

#### Windows

下载并安装：https://ollama.com/download/windows

#### Docker 部署

```bash
# 拉取 Ollama 镜像
docker pull ollama/ollama:latest

# 运行 Ollama 容器
docker run -d \
  --name ollama \
  --gpus all \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  ollama/ollama:latest

# 如果没有 GPU，移除 --gpus all 参数
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  ollama/ollama:latest
```

### 2. 拉取推荐模型

```bash
# 推荐模型：Qwen 2.5 7B（中文支持好，性能均衡）
ollama pull qwen2.5:7b

# 备选模型
ollama pull llama3.1:8b      # 英文场景
ollama pull qwen2.5:14b      # 更强能力，需要更多资源
ollama pull deepseek-coder:6.7b  # 代码分析场景
```

### 3. 启动 Ollama 服务

```bash
# 前台运行（用于调试）
ollama serve

# 后台运行（Linux/macOS）
nohup ollama serve > ollama.log 2>&1 &

# 使用 systemd（Linux）
sudo systemctl start ollama
sudo systemctl enable ollama  # 开机自启
```

### 4. 验证安装

```bash
# 检查服务状态
curl http://localhost:11434/api/tags

# 测试模型推理
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "你好，请介绍一下自己",
  "stream": false
}'
```

### 5. Kubernetes 部署（生产环境）

创建 Ollama Deployment：

```yaml
# k8s/ollama-deployment.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ollama-data
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
            nvidia.com/gpu: "1"  # 如果有 GPU
        volumeMounts:
        - name: ollama-data
          mountPath: /root/.ollama
      volumes:
      - name: ollama-data
        persistentVolumeClaim:
          claimName: ollama-data
---
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: default
spec:
  selector:
    app: ollama
  ports:
  - port: 11434
    targetPort: 11434
  type: ClusterIP
```

部署并拉取模型：

```bash
# 部署 Ollama
kubectl apply -f k8s/ollama-deployment.yaml

# 等待 Pod 就绪
kubectl wait --for=condition=ready pod -l app=ollama --timeout=300s

# 进入容器拉取模型
kubectl exec -it deployment/ollama -- ollama pull qwen2.5:7b

# 验证模型
kubectl exec -it deployment/ollama -- ollama list
```

## OpenAI API 配置

### 1. 获取 API Key

1. 访问 https://platform.openai.com/
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 保存 Key（只显示一次）

### 2. 配置环境变量

```bash
# 设置 API Key
export OPENAI_API_KEY="sk-your-api-key-here"

# 选择模型
export OPENAI_MODEL="gpt-4"  # 或 gpt-3.5-turbo

# 可选：自定义 API 端点（用于代理或兼容服务）
export OPENAI_BASE_URL="https://api.openai.com/v1"
```

### 3. 验证配置

```bash
# 使用 curl 测试
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }'
```

## 环境变量配置

### 完整配置示例

在项目根目录创建 `.env` 文件：

```bash
# ===================================
# AI 诊断助手配置
# ===================================

# 选择 AI 提供商：ollama 或 openai
AI_PROVIDER=ollama

# ===================================
# Ollama 配置（本地 LLM）
# ===================================

# Ollama 服务地址
# 本地开发：http://localhost:11434
# Docker 容器：http://ollama:11434
# Kubernetes：http://ollama.default.svc.cluster.local:11434
OLLAMA_BASE_URL=http://localhost:11434

# 使用的模型名称（必须已经拉取）
OLLAMA_MODEL=qwen2.5:7b

# ===================================
# OpenAI 配置（备选方案）
# ===================================

# OpenAI API Key（使用 OpenAI 时必需）
# OPENAI_API_KEY=sk-your-api-key-here

# OpenAI 模型
# OPENAI_MODEL=gpt-4

# OpenAI API 端点（可选，用于代理）
# OPENAI_BASE_URL=https://api.openai.com/v1

# ===================================
# WebSocket 配置
# ===================================

# 心跳检测间隔（毫秒）
WS_HEARTBEAT_INTERVAL=30000

# ===================================
# 工具配置
# ===================================

# 日志读取最大行数
MAX_LOG_LINES=1000

# 工具执行超时时间（毫秒）
TOOL_TIMEOUT=30000
```

### 配置说明

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `AI_PROVIDER` | 否 | `ollama` | AI 提供商：`ollama` 或 `openai` |
| `OLLAMA_BASE_URL` | 否 | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_MODEL` | 否 | `qwen2.5:7b` | Ollama 模型名称 |
| `OPENAI_API_KEY` | 条件 | - | OpenAI API Key（使用 OpenAI 时必需） |
| `OPENAI_MODEL` | 否 | `gpt-4` | OpenAI 模型名称 |
| `OPENAI_BASE_URL` | 否 | - | OpenAI API 端点（可选） |
| `WS_HEARTBEAT_INTERVAL` | 否 | `30000` | WebSocket 心跳间隔（毫秒） |
| `MAX_LOG_LINES` | 否 | `1000` | 日志读取最大行数 |
| `TOOL_TIMEOUT` | 否 | `30000` | 工具执行超时（毫秒） |

## 健康检查

### 使用内置健康检查 API

应用提供了 LLM 连接健康检查接口：

```bash
# 检查 LLM 连接状态
curl http://localhost:3000/api/ai-diagnostic/health

# 响应示例（正常）
{
  "status": "healthy",
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "timestamp": "2024-12-05T10:30:00.000Z",
  "responseTime": 123
}

# 响应示例（异常）
{
  "status": "unhealthy",
  "provider": "ollama",
  "error": "Failed to connect to Ollama service",
  "timestamp": "2024-12-05T10:30:00.000Z"
}
```

### 手动检查 Ollama

```bash
# 检查 Ollama 服务状态
curl http://localhost:11434/api/tags

# 测试模型推理
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:7b",
  "prompt": "测试",
  "stream": false
}'
```

### 手动检查 OpenAI

```bash
# 测试 OpenAI API 连接
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### 在代码中使用健康检查

```typescript
import { checkLLMHealth } from '@/lib/ai-diagnostic/config'

// 检查 LLM 健康状态
const health = await checkLLMHealth()

if (health.status === 'healthy') {
  console.log(`LLM is healthy: ${health.provider} - ${health.model}`)
} else {
  console.error(`LLM is unhealthy: ${health.error}`)
}
```

## 故障排查

### Ollama 常见问题

#### 1. 服务无法启动

**症状：** `curl: (7) Failed to connect to localhost port 11434`

**解决方案：**
```bash
# 检查 Ollama 进程
ps aux | grep ollama

# 检查端口占用
lsof -i :11434

# 重启服务
pkill ollama
ollama serve
```

#### 2. 模型未找到

**症状：** `model 'qwen2.5:7b' not found`

**解决方案：**
```bash
# 列出已安装的模型
ollama list

# 拉取缺失的模型
ollama pull qwen2.5:7b
```

#### 3. 内存不足

**症状：** 推理速度极慢或服务崩溃

**解决方案：**
- 使用更小的模型（如 `qwen2.5:3b`）
- 增加系统内存
- 使用量化模型（如 `qwen2.5:7b-q4_0`）

#### 4. GPU 未被使用

**症状：** CPU 占用高，GPU 空闲

**解决方案：**
```bash
# 检查 GPU 驱动
nvidia-smi

# 确保 Ollama 使用 GPU
# Docker: 添加 --gpus all 参数
# 本地: Ollama 会自动检测 GPU
```

### OpenAI 常见问题

#### 1. API Key 无效

**症状：** `401 Unauthorized`

**解决方案：**
- 检查 API Key 是否正确
- 确认 API Key 未过期
- 检查账户余额

#### 2. 速率限制

**症状：** `429 Too Many Requests`

**解决方案：**
- 降低请求频率
- 升级 API 套餐
- 实现请求队列和重试机制

#### 3. 网络连接问题

**症状：** `ECONNREFUSED` 或超时

**解决方案：**
- 检查网络连接
- 配置代理（如需要）
- 使用 `OPENAI_BASE_URL` 指向代理服务器

### 应用配置问题

#### 1. 环境变量未生效

**解决方案：**
```bash
# 确认 .env 文件存在
ls -la .env

# 重启应用
npm run dev  # 开发环境
pm2 restart all  # 生产环境
```

#### 2. 健康检查失败

**解决方案：**
```bash
# 检查配置
curl http://localhost:3000/api/ai-diagnostic/health

# 查看应用日志
tail -f logs/app.log

# 验证 LLM 服务可访问
curl $OLLAMA_BASE_URL/api/tags
```

## 性能优化建议

### Ollama 优化

1. **使用 GPU 加速**
   - 确保安装 NVIDIA 驱动和 CUDA
   - 使用 `--gpus all` 参数（Docker）

2. **选择合适的模型**
   - 开发环境：7B 模型
   - 生产环境：14B 模型（如果资源充足）
   - 资源受限：3B 或量化模型

3. **调整并发限制**
   - 限制同时处理的请求数
   - 实现请求队列

4. **模型预加载**
   - 应用启动时预热模型
   - 避免首次请求延迟

### OpenAI 优化

1. **使用流式响应**
   - 减少首字节时间
   - 改善用户体验

2. **控制 Token 使用**
   - 限制 `max_tokens` 参数
   - 优化 Prompt 长度

3. **实现缓存**
   - 缓存常见问题的响应
   - 减少 API 调用次数

## 监控和日志

### 监控指标

建议监控以下指标：

- LLM 服务可用性
- 平均响应时间
- 错误率
- 并发请求数
- 资源使用率（CPU、内存、GPU）

### 日志配置

```typescript
// 在应用中启用详细日志
process.env.DEBUG = 'ai-diagnostic:*'
```

查看日志：

```bash
# 应用日志
tail -f logs/app.log

# Ollama 日志
tail -f ollama.log

# Docker 日志
docker logs -f ollama
```

## 下一步

配置完成后，您可以：

1. 启动应用并访问服务详情页
2. 点击"AI 诊断"按钮测试功能
3. 查看 [AI 诊断助手使用指南](./AI_DIAGNOSTIC_USER_GUIDE.md)
4. 参考 [WebSocket 诊断指南](./WEBSOCKET_DIAGNOSTIC_GUIDE.md)

## 参考资源

- [Ollama 官方文档](https://github.com/ollama/ollama)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Qwen 模型介绍](https://github.com/QwenLM/Qwen)
- [AI 诊断助手设计文档](../.kiro/specs/ai-diagnostic-assistant/design.md)
