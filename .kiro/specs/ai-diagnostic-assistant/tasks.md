# Implementation Plan - AI Diagnostic Assistant

## Task List

- [x] 1. 设置项目基础和依赖
  - 安装 AI SDK 和相关依赖包
  - 配置环境变量和类型定义
  - 创建基础目录结构
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. 实现后端 AI Agent 核心服务
  - 创建 AIAgentService 类，实现与本地 LLM 的通信
  - 实现流式响应处理逻辑
  - 添加错误处理和日志记录
  - _Requirements: 2.2, 2.5_

- [ ]* 2.1 编写 AIAgentService 的属性测试
  - **Property 3: 诊断请求触发工具调用**
  - **Validates: Requirements 3.1**

- [ ]* 2.2 编写 AIAgentService 的属性测试
  - **Property 6: 流式响应逐步追加内容**
  - **Validates: Requirements 2.5**

- [x] 3. 实现工具注册表和基础工具
  - 创建 ToolRegistry 类，管理工具注册和执行
  - 实现参数验证和结果格式化
  - 添加工具执行超时机制
  - _Requirements: 3.1, 3.5_

- [ ]* 3.1 编写 ToolRegistry 的属性测试
  - **Property 5: 工具调用失败返回错误信息**
  - **Validates: Requirements 3.5**

- [x] 4. 实现诊断工具：getPodStatus
  - 使用 @kubernetes/client-node 查询 Pod 状态
  - 获取 Pod 事件信息
  - 格式化返回结果
  - _Requirements: 3.1_

- [ ]* 4.1 编写 getPodStatus 的单元测试
  - 测试正常场景：成功获取 Pod 状态
  - 测试错误场景：Pod 不存在、权限不足

- [x] 5. 实现诊断工具：getServiceLogs
  - 实现日志流式读取
  - 限制最大行数（1000 行）
  - 处理日志截断情况
  - _Requirements: 3.2_

- [ ]* 5.1 编写 getServiceLogs 的属性测试
  - **Property 4: 日志读取限制在指定行数**
  - **Validates: Requirements 3.2**

- [x] 6. 实现诊断工具：getResourceMetrics
  - 集成 Prometheus 客户端
  - 查询 CPU 和内存指标
  - 计算使用率百分比
  - _Requirements: 3.3_

- [ ]* 6.1 编写 getResourceMetrics 的单元测试
  - 测试指标查询和计算逻辑
  - 测试 Prometheus 连接失败场景

- [x] 7. 实现诊断工具：getDeploymentConfig
  - 查询 Deployment 对象
  - 提取关键配置信息
  - 格式化配置数据
  - _Requirements: 3.4_

- [ ]* 7.1 编写 getDeploymentConfig 的单元测试
  - 测试配置提取逻辑
  - 测试 Deployment 不存在场景

- [x] 8. 扩展 WebSocket 服务器
  - 在现有 websocket-server.js 中添加诊断消息处理
  - 实现消息路由到 AI Agent
  - 添加连接管理和心跳检测
  - _Requirements: 1.2, 2.1_

- [ ]* 8.1 编写 WebSocket 服务器的属性测试
  - **Property 1: WebSocket 连接建立后可发送消息**
  - **Validates: Requirements 1.2**

- [ ]* 8.2 编写 WebSocket 服务器的属性测试
  - **Property 7: 关闭面板断开 WebSocket 连接**
  - **Validates: Requirements 1.5**

- [x] 9. 创建前端类型定义
  - 定义 Message、ToolCall 等接口
  - 定义 WebSocket 消息协议类型
  - 创建共享类型文件
  - _Requirements: 1.1, 2.1_

- [x] 10. 实现 AIDiagnosticPanel 组件
  - 创建诊断面板主组件
  - 实现 WebSocket 连接管理
  - 管理消息历史状态
  - 处理面板打开和关闭
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ]* 10.1 编写 AIDiagnosticPanel 的单元测试
  - 测试组件渲染
  - 测试 WebSocket 连接建立
  - 测试面板关闭逻辑

- [x] 11. 实现 MessageList 组件
  - 渲染消息列表
  - 支持 Markdown 格式化
  - 显示工具调用状态
  - 实现自动滚动到最新消息
  - _Requirements: 2.5_

- [ ]* 11.1 编写 MessageList 的单元测试
  - 测试消息渲染
  - 测试 Markdown 格式化
  - 测试自动滚动行为

- [x] 12. 实现 MessageInput 组件
  - 创建输入框组件
  - 实现输入验证（非空检查）
  - 支持回车发送
  - 处理禁用状态
  - _Requirements: 2.1, 2.3_

- [ ]* 12.1 编写 MessageInput 的属性测试
  - **Property 2: 空输入被正确拒绝**
  - **Validates: Requirements 2.3**

- [x] 13. 在服务详情页集成 AI 诊断入口
  - 在服务详情页添加"AI 诊断"按钮
  - 实现面板打开/关闭逻辑
  - 传递服务上下文信息
  - _Requirements: 1.1, 1.2_

- [ ]* 13.1 编写集成测试
  - 测试从服务详情页打开诊断面板
  - 测试服务信息正确传递

- [x] 14. 实现错误处理和用户反馈
  - 添加 WebSocket 连接错误提示
  - 实现重试机制
  - 显示工具调用错误
  - 添加加载状态指示器
  - _Requirements: 1.4, 2.4, 3.5_

- [ ]* 14.1 编写错误处理的单元测试
  - 测试连接失败场景
  - 测试重试逻辑
  - 测试错误提示显示

- [x] 15. 配置本地 LLM 和环境
  - 编写 Ollama 安装和配置文档
  - 创建环境变量配置示例
  - 添加 LLM 连接健康检查
  - _Requirements: 2.2_

- [x] 16. 优化 LLM Prompt 工程
  - 编写系统提示词模板
  - 优化工具描述和参数说明
  - 测试不同问题场景的响应质量
  - _Requirements: 2.2_

- [x] 17. 添加性能优化
  - 实现日志读取超时机制
  - 添加 WebSocket 心跳检测
  - 限制并发连接数
  - 优化流式响应性能
  - _Requirements: 3.2, 3.5_

- [x] 18. 编写用户文档
  - 创建功能使用指南
  - 编写常见问题 FAQ
  - 添加示例诊断场景
  - _Requirements: 1.1, 2.1_

- [ ] 19. Checkpoint - 确保所有测试通过
  - 运行所有单元测试
  - 运行所有属性测试
  - 修复失败的测试
  - 确认代码覆盖率达标

- [ ] 20. 端到端测试和验收
  - 测试完整的诊断流程
  - 验证所有需求场景
  - 性能测试和压力测试
  - 用户验收测试
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_
