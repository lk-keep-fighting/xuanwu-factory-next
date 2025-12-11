# AI 诊断助手故障排查指南

## 问题：配置了环境变量但仍显示模拟模式

### 症状

- ✅ 健康检查 API 返回 `healthy`
- ✅ Ollama 服务正常运行
- ✅ 模型已下载
- ✅ 环境变量已配置
- ❌ AI 诊断助手仍显示"模拟模式"

### 根本原因

WebSocket 服务器在启动时加载 AI 配置。如果在服务器运行时修改了环境变量，需要重启服务器才能生效。

### 解决方案

#### 1. 重启 WebSocket 服务器

```bash
# 停止当前运行的 WebSocket 服务器
# 按 Ctrl+C 或找到进程并终止

# 重新启动
npm run ws:dev
```

#### 2. 验证启动日志

重启后，你应该看到类似的日志：

**✅ 正确的日志（真实 AI）：**
```
[AI] Initializing AI Agent Service...
[AI Integration] Attempting to load AI Agent Service...
[AI Integration] AI Provider: ollama
[AI Integration] Ollama URL: http://192.168.44.151:11434
[AI Integration] Ollama Model: qwen2.5-coder:3b
[AI Integration] ✓ AI Agent Service loaded successfully
[AI] ✓ AI Agent Service initialized successfully
[WebSocket] Server listening on port 3001
```

**❌ 错误的日志（Mock 模式）：**
```
[AI] Initializing AI Agent Service...
[AI Integration] Could not load AI Agent Service: ...
[AI Integration] Using mock implementation
[AI] ⚠️  Using mock AI implementation
[WebSocket] Server listening on port 3001
```

#### 3. 测试 AI 功能

重启后，打开 AI 诊断面板并发送一个问题。你应该看到：

**✅ 真实 AI 响应：**
- 自然的对话风格
- 针对性的分析
- 可能会调用工具获取信息

**❌ Mock 响应：**
- 显示"🤖 AI 诊断助手 (模拟模式)"
- 包含设置说明
- 固定的响应内容

## 完整的故障排查流程

### 步骤 1：验证配置

运行配置测试脚本：

```bash
node test-ai-config.js
```

**预期输出：**
```
🔍 Testing AI Configuration...

📋 Environment Variables:
  AI_PROVIDER: ollama
  OLLAMA_BASE_URL: http://192.168.44.151:11434
  OLLAMA_MODEL: qwen2.5-coder:3b
  OPENAI_API_KEY: ***set***

🔌 Testing Ollama Connection...
  ✓ Ollama is accessible
  ✓ Target model 'qwen2.5-coder:3b' is available

🤖 Testing AI Agent Service...
  ✓ AI Agent Service loaded successfully
  ✓ AI Agent instance created
  ✓ Health check passed
```

如果所有检查都通过（✓），配置是正确的。

### 步骤 2：检查 .env 文件

确保 `.env` 文件格式正确：

```bash
# ✅ 正确
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://192.168.44.151:11434
OLLAMA_MODEL=qwen2.5-coder:3b

# ❌ 错误（包含中文字符）
AI_PROVIDER=提供商：ollama

# ❌ 错误（重复定义）
AI_PROVIDER=openai
AI_PROVIDER=ollama  # 第二个会覆盖第一个
```

### 步骤 3：检查 Ollama 服务

```bash
# 检查 Ollama 是否运行
curl http://192.168.44.151:11434/api/tags

# 应该返回模型列表
{
  "models": [
    {
      "name": "qwen2.5-coder:3b",
      ...
    }
  ]
}
```

### 步骤 4：测试模型推理

```bash
curl http://192.168.44.151:11434/api/generate -d '{
  "model": "qwen2.5-coder:3b",
  "prompt": "你好",
  "stream": false
}'
```

应该返回 AI 生成的响应。

### 步骤 5：重启所有服务

```bash
# 1. 停止 WebSocket 服务器
# 按 Ctrl+C

# 2. 停止 Next.js 开发服务器（如果在运行）
# 按 Ctrl+C

# 3. 重新启动 WebSocket 服务器
npm run ws:dev

# 4. 在另一个终端启动 Next.js
npm run dev
```

### 步骤 6：清除浏览器缓存

有时浏览器会缓存旧的 WebSocket 连接：

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"
4. 或者使用无痕模式测试

## 常见问题

### Q1: 为什么健康检查 API 正常但 WebSocket 还是 Mock？

**A:** 健康检查 API 和 WebSocket 服务器是两个独立的进程：

- **健康检查 API**: 运行在 Next.js 进程中（端口 3000）
- **WebSocket 服务器**: 独立的 Node.js 进程（端口 3001）

它们各自加载配置，需要分别重启。

### Q2: 修改 .env 后需要重启哪些服务？

**A:** 需要重启：
- ✅ WebSocket 服务器（`npm run ws:dev`）
- ✅ Next.js 开发服务器（`npm run dev`）- 如果使用健康检查 API

不需要重启：
- ❌ Ollama 服务（除非修改了 Ollama 配置）
- ❌ 浏览器（但建议刷新页面）

### Q3: 如何确认使用的是真实 AI 而不是 Mock？

**A:** 三种方法：

1. **查看 WebSocket 服务器日志**
   ```
   [AI] ✓ AI Agent Service initialized successfully  # 真实 AI
   [AI] ⚠️  Using mock AI implementation              # Mock
   ```

2. **查看 AI 响应内容**
   - Mock: 显示"🤖 AI 诊断助手 (模拟模式)"
   - 真实: 自然的对话响应

3. **运行测试脚本**
   ```bash
   node test-ai-config.js
   ```

### Q4: 为什么 test-ai-config.js 显示正常但 WebSocket 还是 Mock？

**A:** 测试脚本直接加载模块，而 WebSocket 服务器可能：
- 使用了旧的环境变量（启动时加载的）
- 加载模块时出错（查看启动日志）
- 使用了不同的 .env 文件

**解决方案：** 重启 WebSocket 服务器并查看启动日志。

### Q5: 如何在生产环境部署？

**A:** 生产环境建议：

1. **使用环境变量而不是 .env 文件**
   ```bash
   export AI_PROVIDER=ollama
   export OLLAMA_BASE_URL=http://ollama-service:11434
   export OLLAMA_MODEL=qwen2.5-coder:3b
   ```

2. **使用进程管理器**
   ```bash
   # 使用 PM2
   pm2 start websocket-server.js --name ws-server
   pm2 start npm --name next-app -- start
   
   # 重启服务
   pm2 restart ws-server
   pm2 restart next-app
   ```

3. **配置健康检查**
   ```bash
   # 定期检查服务状态
   */5 * * * * curl -f http://localhost:3000/api/ai-diagnostic/health || pm2 restart ws-server
   ```

## 调试技巧

### 启用详细日志

在 WebSocket 服务器中添加更多日志：

```javascript
// websocket-server.js
console.log('[Debug] Environment variables:')
console.log('  AI_PROVIDER:', process.env.AI_PROVIDER)
console.log('  OLLAMA_BASE_URL:', process.env.OLLAMA_BASE_URL)
console.log('  OLLAMA_MODEL:', process.env.OLLAMA_MODEL)
```

### 使用 Node.js 调试器

```bash
# 启动调试模式
node --inspect websocket-server.js

# 在 Chrome 中打开
chrome://inspect
```

### 监控 WebSocket 连接

在浏览器开发者工具中：

1. 打开 Network 标签
2. 筛选 WS（WebSocket）
3. 查看消息内容
4. 检查连接状态

## 快速修复清单

如果 AI 诊断助手显示模拟模式，按顺序检查：

- [ ] 1. `.env` 文件格式正确（无中文字符、无重复定义）
- [ ] 2. Ollama 服务正在运行
- [ ] 3. 模型已下载
- [ ] 4. 运行 `node test-ai-config.js` 全部通过
- [ ] 5. 重启 WebSocket 服务器
- [ ] 6. 查看启动日志确认加载成功
- [ ] 7. 刷新浏览器页面
- [ ] 8. 测试 AI 诊断功能

## 获取帮助

如果以上步骤都无法解决问题：

1. **收集信息**
   ```bash
   # 运行测试
   node test-ai-config.js > ai-test-result.txt 2>&1
   
   # 查看 WebSocket 日志
   npm run ws:dev > ws-server.log 2>&1
   
   # 检查 Ollama
   curl http://192.168.44.151:11434/api/tags > ollama-status.txt
   ```

2. **检查日志文件**
   - `ai-test-result.txt`
   - `ws-server.log`
   - `ollama-status.txt`

3. **联系技术支持**
   提供以上日志文件和以下信息：
   - Node.js 版本：`node --version`
   - 操作系统
   - 错误信息截图

## 相关文档

- [AI 诊断助手快速开始](./AI_DIAGNOSTIC_QUICK_START.md)
- [AI 诊断助手完整配置](./AI_DIAGNOSTIC_LLM_SETUP.md)
- [WebSocket AI 集成修复](./WEBSOCKET_AI_INTEGRATION_FIX.md)
- [Task 15 完成总结](./TASK_15_LLM_SETUP_SUMMARY.md)
