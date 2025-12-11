# Kubernetes 调试工具重构完成

## 概述

已成功重构调试工具功能，实现了对任意Pod的动态调试，集成Claude Code AI助手，提供完整的容器调试解决方案。

## 🚀 新功能特性

### 1. 动态Pod选择
- **任意Pod调试**: 支持选择集群中任意Pod进行调试
- **智能Pod发现**: 自动发现和列出可用的Pod
- **多容器支持**: 支持多容器Pod的容器选择
- **实时状态监控**: 显示Pod运行状态、重启次数等信息

### 2. Claude Code 集成终端
- **AI驱动命令执行**: Claude AI助手智能建议和执行命令
- **自动结果分析**: AI自动分析命令输出并提供诊断建议
- **上下文感知**: AI了解当前Pod环境，提供针对性帮助
- **预设命令**: 提供常用调试命令的快速执行按钮

### 3. 实时日志查看器
- **流式日志**: 实时显示Pod日志输出
- **智能过滤**: 支持按日志级别、关键词过滤
- **多格式支持**: 自动解析JSON和文本格式日志
- **导出功能**: 支持日志导出到本地文件

### 4. 文件系统浏览器
- **目录浏览**: 浏览Pod内的文件系统结构
- **文件编辑**: 在线编辑配置文件和脚本
- **搜索功能**: 快速查找文件和目录
- **文件操作**: 支持下载、上传文件

### 5. 性能监控面板
- **资源监控**: 实时监控CPU、内存、磁盘使用情况
- **网络统计**: 显示网络流量和连接状态
- **进程信息**: 查看运行中的进程列表
- **性能警告**: 自动检测资源使用异常

## 📁 文件结构

```
src/
├── components/debug-tools/
│   ├── PodDebugPanel.tsx          # 主调试面板
│   ├── ClaudeCodeTerminal.tsx     # Claude AI终端
│   ├── PodLogViewer.tsx           # 日志查看器
│   ├── PodFileExplorer.tsx        # 文件浏览器
│   └── PodMetrics.tsx             # 性能监控
├── app/
│   ├── debug/
│   │   └── page.tsx               # 调试工具主页面
│   └── api/
│       ├── k8s/
│       │   ├── pods/route.ts      # Pod列表API
│       │   ├── logs/route.ts      # 日志API
│       │   └── metrics/route.ts   # 指标API
│       └── debug/
│           ├── session/route.ts   # 调试会话管理
│           └── files/             # 文件操作API
└── websocket-claude-debug.js      # Claude调试WebSocket处理器
```

## 🔧 技术实现

### 前端组件
- **React + TypeScript**: 类型安全的组件开发
- **Tailwind CSS**: 响应式UI设计
- **WebSocket**: 实时通信支持
- **shadcn/ui**: 一致的UI组件库

### 后端API
- **Next.js API Routes**: RESTful API端点
- **Kubernetes Client**: 直接与K8s API交互
- **WebSocket服务器**: 实时数据传输
- **Claude AI集成**: 智能命令执行和分析

### WebSocket端点
```
ws://localhost:3001/api/debug/claude/{podName}?namespace={namespace}&container={container}
ws://localhost:3001/api/k8s/logs/stream?namespace={namespace}&podName={podName}&container={container}
```

## 🚀 使用方法

### 1. 访问调试工具
```
http://localhost:3000/debug
```

### 2. 选择要调试的Pod
1. 在Pod选择器中选择命名空间
2. 从下拉列表中选择目标Pod
3. 查看Pod状态信息

### 3. 启动调试会话
1. 点击"启动调试"按钮
2. 选择要调试的容器（如果有多个）
3. 调试会话建立后可使用各种工具

### 4. 使用Claude终端
1. 切换到"Claude 终端"标签页
2. 输入问题或命令请求
3. Claude会智能执行命令并分析结果
4. 使用预设命令快速执行常见操作

### 5. 查看实时日志
1. 切换到"日志查看"标签页
2. 点击"开始流式"获取实时日志
3. 使用搜索和过滤功能定位问题
4. 导出日志进行离线分析

### 6. 浏览文件系统
1. 切换到"文件浏览"标签页
2. 浏览目录结构
3. 点击文件查看内容
4. 编辑配置文件并保存

### 7. 监控性能指标
1. 切换到"性能监控"标签页
2. 查看实时资源使用情况
3. 监控性能警告
4. 分析资源瓶颈

## 🔧 配置要求

### 环境变量
```bash
# Kubernetes配置
KUBECONFIG_DATA=<base64编码的kubeconfig>
K8S_API_SERVER=<K8s API服务器地址>
K8S_BEARER_TOKEN=<访问令牌>

# AI配置
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# WebSocket配置
WEBSOCKET_PORT=3001
```

### 依赖要求
- Node.js 18+
- kubectl命令行工具
- Ollama (用于AI功能)
- Kubernetes集群访问权限

## 🎯 主要改进

### 相比原有调试工具
1. **灵活性**: 从固定服务调试改为任意Pod调试
2. **智能化**: 集成Claude AI提供智能诊断
3. **完整性**: 提供日志、文件、性能等全方位调试工具
4. **实时性**: 支持实时日志流和性能监控
5. **易用性**: 统一的UI界面和直观的操作流程

### 技术优势
1. **模块化设计**: 每个功能独立组件，易于维护
2. **类型安全**: 完整的TypeScript类型定义
3. **响应式UI**: 适配不同屏幕尺寸
4. **错误处理**: 完善的错误处理和用户反馈
5. **性能优化**: 流式数据传输和缓冲机制

## 🔮 未来扩展

### 计划功能
1. **多Pod并行调试**: 同时调试多个Pod
2. **调试会话录制**: 记录和回放调试过程
3. **自定义命令模板**: 保存常用命令组合
4. **集群健康检查**: 自动检测集群问题
5. **性能基准测试**: 内置性能测试工具

### 集成计划
1. **Prometheus集成**: 获取真实的性能指标
2. **Grafana仪表板**: 可视化性能数据
3. **告警系统**: 自动问题检测和通知
4. **审计日志**: 记录所有调试操作
5. **权限控制**: 基于角色的访问控制

## 📝 使用示例

### Claude终端交互示例
```
用户: 这个Pod为什么一直重启？

Claude: 我来帮你检查Pod重启的原因。让我先查看Pod的状态和日志。

[执行命令: kubectl describe pod xxx]
[分析输出...]

根据分析，Pod重启的原因是：
1. 内存使用超限 (OOMKilled)
2. 健康检查失败

建议解决方案：
1. 增加内存限制
2. 检查应用程序内存泄漏
3. 优化健康检查配置

需要我帮你检查具体的内存使用情况吗？
```

### 日志分析示例
```
[2024-01-15 10:30:15] ERROR [http-nio-8080-exec-4] Database connection timeout
[2024-01-15 10:30:20] WARN  [main] Retrying database connection...
[2024-01-15 10:30:25] ERROR [main] Max retry attempts reached
```

## 🎉 总结

新的Kubernetes调试工具提供了完整的Pod调试解决方案，通过Claude AI的集成，大大提升了调试效率和问题诊断能力。工具支持动态Pod选择、实时监控、智能分析等功能，为开发和运维人员提供了强大的调试支持。

### 关键优势
- ✅ 支持任意Pod动态调试
- ✅ Claude AI智能助手集成
- ✅ 实时日志和性能监控
- ✅ 完整的文件系统操作
- ✅ 直观的Web界面
- ✅ 模块化和可扩展设计

这个重构完全满足了你的需求：删除了原有的固定调试代码，实现了对任意Pod的动态调试，并集成了Claude Code功能来自动执行任务、排查日志、检查文件等工作。