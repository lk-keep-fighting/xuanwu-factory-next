# Requirements Document

## Introduction

本文档定义了服务详情页 AI 诊断助手功能的需求。该功能旨在通过集成本地 AI 模型和工具链，为用户提供智能化的服务问题诊断、日志分析能力，替代传统的手动排查流程。

本文档采用分阶段实现策略：
- **MVP 阶段**：实现基础的 AI 诊断面板、自然语言交互、自动状态收集（需求 1-3）
- **后续阶段**：扩展自动修复、会话管理、实时监听、知识学习等高级功能（需求 4-11）

## Glossary

- **AI Agent**: 智能代理，能够理解用户自然语言描述，自动执行诊断任务的 AI 系统
- **Service Detail Page**: 服务详情页，显示单个 Kubernetes 服务的状态、配置、日志等信息的页面
- **Diagnostic Session**: 诊断会话，用户与 AI Agent 进行问题排查的一次完整交互过程
- **Tool Chain**: 工具链，AI Agent 可以调用的一组系统工具，包括 kubectl、日志查询、指标查询等
- **Local LLM**: 本地大语言模型，部署在集群内部的 AI 推理服务（如 Ollama、vLLM）
- **WebSocket Connection**: WebSocket 连接，用于实现前端与后端 AI Agent 之间的实时双向通信
- **Diagnostic Context**: 诊断上下文，包含当前服务的状态、历史操作、相关日志等信息
- **Streaming Response**: 流式响应，AI 模型逐步输出分析结果的响应方式
- **Prometheus**: 监控系统，提供服务的指标数据
- **Pod**: Kubernetes 中的最小部署单元
- **Deployment**: Kubernetes 部署对象，管理 Pod 的副本和更新
- **kubectl**: Kubernetes 命令行工具，用于与集群交互

## Requirements

---

## MVP 阶段需求（优先实现）

### Requirement 1

**User Story:** 作为运维人员，我希望在服务详情页快速启动 AI 诊断助手，以便用自然语言描述问题并获得智能分析

#### Acceptance Criteria

1. WHEN 用户访问服务详情页 THEN 系统应当在页面显示"AI 诊断"入口按钮
2. WHEN 用户点击"AI 诊断"按钮 THEN 系统应当打开 AI 诊断助手面板并建立 WebSocket 连接
3. WHEN AI 诊断助手面板打开 THEN 系统应当显示欢迎消息和输入框
4. WHEN WebSocket 连接建立失败 THEN 系统应当显示错误提示并提供重试选项
5. WHEN 用户关闭诊断面板 THEN 系统应当断开 WebSocket 连接

### Requirement 2

**User Story:** 作为运维人员，我希望通过自然语言描述问题，以便 AI 能够理解我的意图并开始诊断

#### Acceptance Criteria

1. WHEN 用户在输入框输入问题描述并提交 THEN 系统应当通过 WebSocket 发送消息到后端 AI Agent
2. WHEN AI Agent 接收到用户消息 THEN 系统应当解析用户意图并确定需要执行的诊断步骤
3. WHEN 用户输入为空或仅包含空白字符 THEN 系统应当阻止提交并提示用户输入有效内容
4. WHEN AI Agent 正在处理请求 THEN 系统应当在界面显示加载状态
5. WHEN AI Agent 生成分析结果 THEN 系统应当以流式方式逐步显示分析内容

### Requirement 3

**User Story:** 作为运维人员，我希望 AI 能够自动收集服务的状态信息，以便快速定位问题根源

#### Acceptance Criteria

1. WHEN AI Agent 开始诊断 THEN 系统应当自动查询当前服务的 Pod 状态和事件
2. WHEN AI Agent 需要日志信息 THEN 系统应当读取最近的服务日志（最多 1000 行）
3. WHEN AI Agent 需要资源使用情况 THEN 系统应当查询 Prometheus 获取 CPU 和内存指标
4. WHEN AI Agent 需要配置信息 THEN 系统应当读取服务的 Deployment 配置
5. WHEN 工具调用失败 THEN 系统应当记录错误并向 AI Agent 返回失败信息

---

## 后续阶段需求（MVP 后实现）

### Requirement 4

**User Story:** 作为运维人员，我希望 AI 能够提供自动修复选项，以便快速解决常见问题

#### Acceptance Criteria

1. WHEN AI Agent 识别出可自动修复的问题 THEN 系统应当显示"自动修复"按钮和修复说明
2. WHEN 用户点击"自动修复"按钮 THEN 系统应当显示确认对话框并列出将要执行的操作
3. WHEN 用户确认自动修复 THEN 系统应当执行修复命令并实时显示执行结果
4. WHEN 自动修复成功 THEN 系统应当验证问题是否解决并通知用户
5. WHEN 自动修复失败 THEN 系统应当提供手动修复指导

### Requirement 5

**User Story:** 作为运维人员，我希望查看历史诊断会话，以便参考之前的问题和解决方案

#### Acceptance Criteria

1. WHEN 用户打开 AI 诊断面板 THEN 系统应当显示最近的诊断会话列表
2. WHEN 用户选择历史会话 THEN 系统应当加载并显示该会话的完整对话记录
3. WHEN 用户在历史会话中继续提问 THEN 系统应当基于历史上下文进行分析
4. WHEN 用户创建新会话 THEN 系统应当清空当前上下文并开始新的诊断流程
5. WHEN 会话数量超过 50 个 THEN 系统应当自动删除最旧的会话记录

### Requirement 6

**User Story:** 作为运维人员，我希望 AI 能够分析大量日志并识别异常模式，以便快速发现隐藏的问题

#### Acceptance Criteria

1. WHEN AI Agent 分析日志 THEN 系统应当支持处理至少 10000 行日志数据
2. WHEN 日志中包含错误或异常 THEN 系统应当识别并提取关键错误信息
3. WHEN 多个 Pod 的日志存在关联问题 THEN 系统应当关联分析并指出共同原因
4. WHEN 日志量过大 THEN 系统应当采用采样或时间窗口策略避免超时
5. WHEN 日志包含堆栈跟踪 THEN 系统应当解析堆栈并定位到具体代码位置

### Requirement 7

**User Story:** 作为运维人员，我希望 AI 能够实时监听服务状态变化，以便主动发现和报告问题

#### Acceptance Criteria

1. WHEN 用户启用实时监听模式 THEN 系统应当订阅服务的 Pod 事件和日志流
2. WHEN 服务发生异常事件（如 Pod 重启、OOMKilled）THEN 系统应当主动通知用户并提供初步分析
3. WHEN 日志中出现新的错误模式 THEN 系统应当自动分析并在面板中显示警告
4. WHEN 用户关闭实时监听 THEN 系统应当取消订阅并停止主动通知
5. WHEN 实时监听超过 30 分钟 THEN 系统应当提示用户是否继续监听

### Requirement 8

**User Story:** 作为系统管理员，我希望配置 AI 模型和工具权限，以便控制 AI 的能力范围和安全性

#### Acceptance Criteria

1. WHEN 系统管理员访问设置页面 THEN 系统应当提供 AI 诊断配置选项
2. WHEN 管理员配置本地 LLM 地址 THEN 系统应当验证连接并显示模型信息
3. WHEN 管理员设置工具权限 THEN 系统应当限制 AI Agent 可以执行的操作范围
4. WHEN 管理员禁用自动修复功能 THEN 系统应当仅提供诊断建议而不执行修复操作
5. WHEN 配置更新 THEN 系统应当在下次诊断会话中应用新配置

### Requirement 9

**User Story:** 作为开发人员，我希望 AI 能够提供代码级别的问题分析，以便快速定位应用程序 bug

#### Acceptance Criteria

1. WHEN 日志包含应用程序异常 THEN 系统应当识别异常类型和可能的原因
2. WHEN AI Agent 分析堆栈跟踪 THEN 系统应当提供相关代码文件和行号的链接
3. WHEN 问题与配置相关 THEN 系统应当对比当前配置与最佳实践并指出差异
4. WHEN 问题与资源限制相关 THEN 系统应当分析资源使用趋势并提供调整建议
5. WHEN 问题需要查看源代码 THEN 系统应当提示用户提供代码仓库访问权限

### Requirement 10

**User Story:** 作为运维人员，我希望 AI 诊断结果可以导出和分享，以便与团队协作解决问题

#### Acceptance Criteria

1. WHEN 用户点击"导出诊断报告"按钮 THEN 系统应当生成包含完整诊断过程的 Markdown 文档
2. WHEN 导出报告 THEN 系统应当包含问题描述、诊断步骤、分析结果和修复建议
3. WHEN 用户选择分享会话 THEN 系统应当生成唯一链接供其他用户访问
4. WHEN 其他用户访问分享链接 THEN 系统应当显示只读的诊断会话内容
5. WHEN 分享链接超过 7 天 THEN 系统应当自动失效并提示链接已过期

### Requirement 11

**User Story:** 作为运维人员，我希望 AI 能够学习历史问题和解决方案，以便提供更准确的诊断

#### Acceptance Criteria

1. WHEN 用户标记诊断结果为"有帮助" THEN 系统应当记录该诊断案例到知识库
2. WHEN AI Agent 遇到相似问题 THEN 系统应当优先参考知识库中的成功案例
3. WHEN 用户提供反馈（如"这个建议无效"）THEN 系统应当更新知识库并调整后续建议
4. WHEN 知识库包含相关案例 THEN 系统应当在诊断结果中引用相似历史问题
5. WHEN 知识库条目超过 1000 条 THEN 系统应当使用向量检索提高查询效率
