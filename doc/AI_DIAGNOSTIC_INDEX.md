# AI 诊断助手 - 文档索引

欢迎使用 AI 诊断助手！本文档索引帮助您快速找到所需的信息。

## 📚 文档概览

### 新手入门

如果您是第一次使用 AI 诊断助手，建议按以下顺序阅读：

1. **[快速开始指南](./AI_DIAGNOSTIC_QUICK_START.md)** ⭐ 推荐首先阅读
   - 5 分钟快速配置
   - 安装 Ollama 和 AI 模型
   - 验证配置是否正确
   - 开始使用 AI 诊断

2. **[用户使用指南](./AI_DIAGNOSTIC_USER_GUIDE.md)**
   - 功能介绍和使用场景
   - 如何提出好问题
   - 理解 AI 的工作流程
   - 最佳实践和技巧

3. **[示例场景](./AI_DIAGNOSTIC_EXAMPLES.md)**
   - 8 个真实诊断场景
   - 完整的问题分析过程
   - 具体的解决方案
   - 可直接参考和应用

### 配置和管理

4. **[完整配置指南](./AI_DIAGNOSTIC_LLM_SETUP.md)**
   - 详细的安装步骤
   - 多种部署方案
   - 环境变量配置
   - 性能优化建议

5. **[故障排查指南](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)**
   - 常见问题诊断
   - 配置问题解决
   - 模拟模式排查
   - 完整的排查流程

6. **[常见问题 FAQ](./AI_DIAGNOSTIC_FAQ.md)**
   - 30+ 个常见问题
   - 详细的解答
   - 使用技巧
   - 安全和隐私说明

### 高级主题

7. **[Prompt 工程指南](./AI_PROMPT_ENGINEERING.md)**
   - Prompt 设计原则
   - 系统提示词优化
   - 场景检测机制
   - 提示词最佳实践

8. **[性能优化指南](./AI_DIAGNOSTIC_PERFORMANCE.md)**
   - 性能分析和优化
   - 资源使用监控
   - 响应时间优化
   - 并发处理优化

9. **[WebSocket 诊断指南](./WEBSOCKET_DIAGNOSTIC_GUIDE.md)**
   - WebSocket 架构
   - 消息协议
   - 连接管理
   - 调试技巧

---

## 🎯 按需求查找文档

### 我想...

#### 开始使用

- **快速上手** → [快速开始指南](./AI_DIAGNOSTIC_QUICK_START.md)
- **了解功能** → [用户使用指南](./AI_DIAGNOSTIC_USER_GUIDE.md)
- **查看示例** → [示例场景](./AI_DIAGNOSTIC_EXAMPLES.md)

#### 解决问题

- **配置不工作** → [故障排查指南](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)
- **显示模拟模式** → [故障排查指南 - Q15](./AI_DIAGNOSTIC_TROUBLESHOOTING.md#q15-显示模拟模式是什么意思)
- **响应很慢** → [FAQ - Q16](./AI_DIAGNOSTIC_FAQ.md#q16-ai-响应很慢怎么办)
- **回答不准确** → [FAQ - Q20](./AI_DIAGNOSTIC_FAQ.md#q20-ai-的回答不准确怎么办)

#### 配置和部署

- **安装 Ollama** → [快速开始 - 步骤 1-3](./AI_DIAGNOSTIC_QUICK_START.md#快速开始推荐ollama)
- **选择模型** → [FAQ - Q12](./AI_DIAGNOSTIC_FAQ.md#q12-推荐使用哪个-ai-模型)
- **使用 OpenAI** → [FAQ - Q13](./AI_DIAGNOSTIC_FAQ.md#q13-可以使用-openai-api-吗)
- **Docker 部署** → [完整配置指南 - Docker 部署](./AI_DIAGNOSTIC_LLM_SETUP.md#docker-部署)
- **生产环境** → [FAQ - Q24](./AI_DIAGNOSTIC_FAQ.md#q24-可以在生产环境使用吗)

#### 学习和优化

- **提高准确性** → [Prompt 工程指南](./AI_PROMPT_ENGINEERING.md)
- **提升性能** → [性能优化指南](./AI_DIAGNOSTIC_PERFORMANCE.md)
- **理解架构** → [FAQ - Q27](./AI_DIAGNOSTIC_FAQ.md#q27-ai-诊断助手的技术架构是什么)

---

## 📖 文档详细说明

### 1. 快速开始指南
**文件**：`AI_DIAGNOSTIC_QUICK_START.md`  
**适合**：新用户、快速配置  
**内容**：
- ✅ Ollama 安装（macOS/Linux/Windows）
- ✅ 模型下载和配置
- ✅ 环境变量设置
- ✅ 健康检查验证
- ✅ 常见问题快速解答

**预计阅读时间**：5-10 分钟

---

### 2. 用户使用指南
**文件**：`AI_DIAGNOSTIC_USER_GUIDE.md`  
**适合**：所有用户  
**内容**：
- 📱 功能介绍和使用场景
- 💬 如何提出好问题
- 🔄 AI 工作流程说明
- 📝 5 个常见使用场景
- ✨ 最佳实践和技巧
- ⚠️ 功能限制说明
- 🔒 隐私和安全
- 🐛 故障排除

**预计阅读时间**：20-30 分钟

---

### 3. 示例场景
**文件**：`AI_DIAGNOSTIC_EXAMPLES.md`  
**适合**：实践学习  
**内容**：
- 🔴 场景 1：ImagePullBackOff
- 🔴 场景 2：CrashLoopBackOff
- 🔴 场景 3：OOMKilled
- 🟡 场景 4：CPU 使用率过高
- 🟡 场景 5：数据库连接失败
- 🟡 场景 6：ConfigMap 缺失
- 🟢 场景 7：应用程序错误
- 🟢 场景 8：网络超时

每个场景包含：
- 问题描述
- 用户提问示例
- AI 诊断过程
- 完整的 AI 响应
- 解决方案和验证步骤

**预计阅读时间**：30-40 分钟

---

### 4. 完整配置指南
**文件**：`AI_DIAGNOSTIC_LLM_SETUP.md`  
**适合**：系统管理员、DevOps  
**内容**：
- 🔧 详细安装步骤
- 🐳 Docker 部署方案
- ☸️ Kubernetes 部署
- ⚙️ 环境变量配置
- 📊 监控和日志
- 🔒 安全配置
- 🚀 性能优化

**预计阅读时间**：40-60 分钟

---

### 5. 故障排查指南
**文件**：`AI_DIAGNOSTIC_TROUBLESHOOTING.md`  
**适合**：遇到问题时查阅  
**内容**：
- 🔍 配置验证步骤
- 🐛 模拟模式排查
- 🔄 服务重启指南
- 📝 日志分析方法
- ✅ 快速修复清单
- 🆘 获取帮助的方式

**预计阅读时间**：15-20 分钟

---

### 6. 常见问题 FAQ
**文件**：`AI_DIAGNOSTIC_FAQ.md`  
**适合**：快速查找答案  
**内容**：
- ❓ 30+ 个常见问题
- 📚 基础问题（Q1-Q4）
- 💬 使用问题（Q5-Q10）
- ⚙️ 配置问题（Q11-Q15）
- ⚡ 性能问题（Q16-Q18）
- 🔧 故障排查（Q19-Q21）
- 🔒 安全和隐私（Q22-Q24）
- 🎓 高级话题（Q25-Q30）

**预计阅读时间**：按需查阅

---

### 7. Prompt 工程指南
**文件**：`AI_PROMPT_ENGINEERING.md`  
**适合**：高级用户、开发者  
**内容**：
- 🎯 Prompt 设计原则
- 📝 系统提示词结构
- 🔍 场景检测机制
- 🛠️ 工具描述优化
- 📊 效果评估方法
- 🔄 持续改进流程

**预计阅读时间**：30-40 分钟

---

### 8. 性能优化指南
**文件**：`AI_DIAGNOSTIC_PERFORMANCE.md`  
**适合**：性能调优  
**内容**：
- 📊 性能基准测试
- ⚡ 响应时间优化
- 💾 内存使用优化
- 🔄 并发处理优化
- 📈 监控和指标
- 🎯 优化建议

**预计阅读时间**：25-35 分钟

---

### 9. WebSocket 诊断指南
**文件**：`WEBSOCKET_DIAGNOSTIC_GUIDE.md`  
**适合**：开发者、调试  
**内容**：
- 🏗️ WebSocket 架构
- 📡 消息协议定义
- 🔌 连接管理
- 🐛 调试技巧
- 🔧 故障排查

**预计阅读时间**：20-30 分钟

---

## 🔍 按问题类型查找

### 配置问题

| 问题 | 文档 | 章节 |
|------|------|------|
| 如何安装 Ollama？ | 快速开始指南 | 步骤 1 |
| 如何选择模型？ | FAQ | Q12 |
| 环境变量怎么配置？ | 快速开始指南 | 步骤 5 |
| 如何验证配置？ | 快速开始指南 | 步骤 8 |
| 显示模拟模式 | 故障排查指南 | 完整流程 |

### 使用问题

| 问题 | 文档 | 章节 |
|------|------|------|
| 如何开始使用？ | 用户使用指南 | 快速开始 |
| 如何提问？ | 用户使用指南 | 使用技巧 |
| 响应很慢 | FAQ | Q16-Q18 |
| 回答不准确 | FAQ | Q20 |
| 工具调用失败 | FAQ | Q21 |

### 诊断场景

| 场景 | 文档 | 示例 |
|------|------|------|
| Pod 启动失败 | 示例场景 | 场景 1-2 |
| 资源不足 | 示例场景 | 场景 3-4 |
| 网络问题 | 示例场景 | 场景 5, 8 |
| 配置错误 | 示例场景 | 场景 6 |
| 应用错误 | 示例场景 | 场景 7 |

---

## 📋 学习路径

### 路径 1：快速上手（30 分钟）
1. 阅读 [快速开始指南](./AI_DIAGNOSTIC_QUICK_START.md)（10 分钟）
2. 配置 Ollama 和模型（15 分钟）
3. 测试 AI 诊断功能（5 分钟）

### 路径 2：深入学习（2 小时）
1. 快速上手（30 分钟）
2. 阅读 [用户使用指南](./AI_DIAGNOSTIC_USER_GUIDE.md)（30 分钟）
3. 学习 [示例场景](./AI_DIAGNOSTIC_EXAMPLES.md)（40 分钟）
4. 浏览 [FAQ](./AI_DIAGNOSTIC_FAQ.md)（20 分钟）

### 路径 3：专家级（4+ 小时）
1. 深入学习（2 小时）
2. 阅读 [完整配置指南](./AI_DIAGNOSTIC_LLM_SETUP.md)（1 小时）
3. 学习 [Prompt 工程](./AI_PROMPT_ENGINEERING.md)（40 分钟）
4. 研究 [性能优化](./AI_DIAGNOSTIC_PERFORMANCE.md)（30 分钟）
5. 了解 [WebSocket 架构](./WEBSOCKET_DIAGNOSTIC_GUIDE.md)（20 分钟）

---

## 🆘 获取帮助

### 自助资源

1. **搜索 FAQ**：大多数问题都有答案
2. **查看示例**：找到相似的场景
3. **运行测试**：使用 `test-ai-config.js` 验证配置
4. **查看日志**：检查错误信息

### 技术支持

如果文档无法解决您的问题：

1. **收集信息**
   - 错误信息和截图
   - 配置文件内容
   - 测试脚本输出
   - 日志文件

2. **联系支持**
   - 📧 技术支持邮箱
   - 💬 内部协作平台
   - 🎫 工单系统

3. **提供反馈**
   - 报告文档问题
   - 建议改进方向
   - 分享使用经验

---

## 📝 文档维护

### 版本信息

- **当前版本**：1.0.0 (MVP)
- **最后更新**：2024-12-05
- **维护者**：开发团队

### 更新日志

**v1.0.0 (2024-12-05)**
- ✅ 初始版本发布
- ✅ 完整的用户文档
- ✅ 8 个示例场景
- ✅ 30+ 个 FAQ

### 贡献指南

欢迎改进文档：

1. 发现错误或不清楚的地方
2. 提出改进建议
3. 分享使用经验
4. 补充新的示例

---

## 🔗 相关资源

### 内部文档

- [设计文档](../.kiro/specs/ai-diagnostic-assistant/design.md)
- [需求文档](../.kiro/specs/ai-diagnostic-assistant/requirements.md)
- [任务列表](../.kiro/specs/ai-diagnostic-assistant/tasks.md)

### 外部资源

- [Ollama 官方文档](https://ollama.com/docs)
- [Qwen 模型介绍](https://github.com/QwenLM/Qwen)
- [Kubernetes 文档](https://kubernetes.io/docs/)

---

**提示**：建议将本文档加入书签，方便随时查阅！

如有任何问题或建议，欢迎反馈给开发团队。
