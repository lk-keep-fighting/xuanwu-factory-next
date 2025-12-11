# AI 诊断助手 - 快速开始指南

本指南帮助您在 5 分钟内快速配置并启动 AI 诊断助手功能。

## 前置条件

- Node.js 18+ 已安装
- 项目已正常运行
- 有访问 Kubernetes 集群的权限

## 快速开始（推荐：Ollama）

### 1. 安装 Ollama

**macOS / Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS (Homebrew):**
```bash
brew install ollama
```

**Windows:**
下载安装包：https://ollama.com/download/windows

### 2. 启动 Ollama 服务

```bash
ollama serve
```

保持此终端窗口打开，或在后台运行：
```bash
nohup ollama serve > ollama.log 2>&1 &
```

### 3. 拉取推荐模型

```bash
# 推荐：Qwen 2.5 7B（中文支持好，性能均衡）
ollama pull qwen2.5:7b
```

等待模型下载完成（约 4.7GB）。

### 4. 验证安装

```bash
# 检查服务状态
curl http://localhost:11434/api/tags

# 应该看到类似输出：
# {"models":[{"name":"qwen2.5:7b",...}]}
```

### 5. 配置环境变量

在项目根目录的 `.env` 文件中添加（如果使用默认配置，可以跳过此步骤）：

```bash
# AI 诊断助手配置（可选，以下为默认值）
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

### 6. 启动应用

```bash
npm run dev
```

### 7. 测试功能

1. 访问任意服务详情页
2. 点击页面上的 **"AI 诊断"** 按钮
3. 在输入框中输入问题，例如：
   - "这个服务为什么启动失败？"
   - "帮我分析一下最近的错误日志"
   - "CPU 使用率为什么这么高？"
4. 等待 AI 分析并返回结果

### 8. 健康检查

访问健康检查接口验证配置：

```bash
curl http://localhost:3000/api/ai-diagnostic/health
```

**正常响应：**
```json
{
  "status": "healthy",
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "timestamp": "2024-12-05T10:30:00.000Z",
  "responseTime": 123
}
```

**异常响应：**
```json
{
  "status": "unhealthy",
  "provider": "ollama",
  "error": "Model 'qwen2.5:7b' not found",
  "timestamp": "2024-12-05T10:30:00.000Z"
}
```

## 备选方案：使用 OpenAI API

如果您无法运行本地 LLM，可以使用 OpenAI API：

### 1. 获取 API Key

访问 https://platform.openai.com/ 获取 API Key

### 2. 配置环境变量

在 `.env` 文件中添加：

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4
```

### 3. 启动应用并测试

```bash
npm run dev
```

访问健康检查接口验证：
```bash
curl http://localhost:3000/api/ai-diagnostic/health
```

## 常见问题

### Q1: Ollama 服务无法启动

**A:** 检查端口 11434 是否被占用：
```bash
lsof -i :11434
```

如果被占用，可以修改 Ollama 端口或停止占用进程。

### Q2: 模型下载速度慢

**A:** Ollama 从官方源下载模型，可能较慢。建议：
- 使用稳定的网络连接
- 选择较小的模型（如 `qwen2.5:3b`）
- 在非高峰时段下载

### Q3: AI 响应速度慢

**A:** 可能原因：
- CPU 模式运行（推荐使用 GPU）
- 模型过大（尝试 7B 或更小的模型）
- 系统资源不足（关闭其他应用）

### Q4: 健康检查返回 unhealthy

**A:** 按以下步骤排查：
1. 确认 Ollama 服务正在运行：`curl http://localhost:11434/api/tags`
2. 确认模型已下载：`ollama list`
3. 检查环境变量配置是否正确
4. 查看应用日志：`tail -f logs/app.log`

### Q5: Docker 环境如何配置？

**A:** 参考完整文档：[AI_DIAGNOSTIC_LLM_SETUP.md](./AI_DIAGNOSTIC_LLM_SETUP.md#docker-部署)

## 下一步

- 📖 阅读 [完整配置指南](./AI_DIAGNOSTIC_LLM_SETUP.md)
- 🔧 了解 [高级配置选项](./AI_DIAGNOSTIC_LLM_SETUP.md#环境变量配置)
- 🐛 查看 [故障排查指南](./AI_DIAGNOSTIC_LLM_SETUP.md#故障排查)
- 📊 配置 [监控和日志](./AI_DIAGNOSTIC_LLM_SETUP.md#监控和日志)

## 获取帮助

如果遇到问题：
1. 查看 [故障排查指南](./AI_DIAGNOSTIC_LLM_SETUP.md#故障排查)
2. 检查应用日志
3. 访问健康检查接口获取详细错误信息
4. 联系技术支持团队

---

**提示：** 首次使用时，AI 可能需要几秒钟加载模型。后续请求会更快。
