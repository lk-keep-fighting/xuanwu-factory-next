# AI 员工模块设计

## 1. 背景与目标

为了让团队在管理与调度 AI Agent 时拥有与“员工”同等的可视化与流程化体验，本模块旨在：

- 以“AI 员工”为抽象，统一管理不同类型的智能体（研发、测试等）。
- 通过角色模板规范 AI Agent 的行为边界与能力，使其在接收任务时具备一致且可控的表现。
- 让产品/研发/运维同事可以像分配任务给真实员工一样，将任务派发给合适的 AI 员工，并追踪执行情况。

## 2. 术语与角色定义

| 概念 | 说明 |
| --- | --- |
| AI 员工 | 可执行任务的虚拟智能体实例，具备角色类型（研发 / 测试）与关联的角色模板。 |
| AI 角色模板 | 预设的指令、技能、权限集合，用于指导 AI 员工的任务行为，可在创建员工时引用或新建。 |
| 任务 | 由人工或系统发起，需要 AI 员工执行的具体工作（如生成代码、撰写测试脚本等）。 |
| 项目/应用/代码分支 | 任务上下文，用于限制 AI 员工操作的代码仓或环境范围。 |

## 3. 功能范围与需求拆解

### 3.1 新增/管理 AI 员工

- 支持从“AI 员工列表”入口点击“新增 AI 员工”。
- 新增表单字段：
  - 基础信息：姓名/昵称、员工类型（研发人员、测试人员）。
  - 模型配置：默认模型提供方、模型名称、温度/最大 token 等参数。
  - 角色模板：可选择已有模板，也可以在表单内快速新建自定义模板。
  - 权限配置：可选项目、仓库、工具使用范围（预留）。
- 允许启用/停用员工（软删除），停用后不可被派发任务。
- 员工详情页展示其基础信息、关联模板、历史任务记录（分页）。

### 3.2 AI 角色模板管理

- 模板字段：模板名称、适用员工类型、系统提示（System Prompt）、行为约束（Guardrails）、推荐工具权限、默认模型配置。
- 模板可单独管理（列表/新增/编辑/复制），也可在创建员工时内嵌创建。
- 模板变更后，可选择是否同步更新已引用的 AI 员工（需提示影响范围）。

### 3.3 AI 员工列表

- 列表列项：员工名称、角色类型、关联模板、执行任务数（总计）、最近一次任务时间、状态。
- 支持筛选/排序：按角色类型、状态筛选，按任务数/最近任务时间排序。
- 支持批量操作（派发任务、停用、删除）。

### 3.4 任务派发

- 在列表或员工详情中可发起“派发任务”。
- 派发流程：
  1. 选择单个或多个 AI 员工。
  2. 选择项目 / 应用 / 代码分支（必选，确保上下文约束）。
  3. 填写任务描述、附加需求（如执行限制、验收标准）。
  4. 触发派发 API（首期使用 Mock 实现，模拟任务受理并返回任务 ID）。
- Mock 行为：返回 `202 Accepted` + 任务占位 ID，并异步更新任务状态为“执行中”。
- 前端提示派发结果，并在员工的任务计数中增加待办记录。

## 4. 核心业务流程概览

1. **角色模板管理**：管理员创建/维护模板，定义不同类型 AI 员工的行为准则。
2. **AI 员工上架**：运营或技术负责人根据需求创建 AI 员工，选择合适模板与模型能力。
3. **任务派发**：
   - 产品或研发负责人选择 AI 员工；
   - 绑定任务上下文（项目/应用/分支）；
   - 提交任务请求，交由后台（Mock）服务处理；
   - 后续由任务中心或队列推动任务执行与状态回写。
4. **执行反馈**：
   - Mock 阶段：前端轮询或手动刷新查看任务状态（模拟完成/失败）。
   - 正式阶段：接入真实任务执行服务，由后端回写执行结果、日志、产出文件。

## 5. 数据模型设计（草案）

> 下述模型以 Prisma 风格描述，最终需与现有数据库规范对齐。

### 5.1 AIEmployee

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | 主键 |
| name | string | 员工名称 |
| type | enum("ENGINEER", "QA") | 员工类型（研发人员 / 测试人员） |
| roleTemplateId | string | 关联角色模板 |
| modelProvider | string | 默认模型提供方（如 openai、claude） |
| modelName | string | 默认模型名称 |
| modelParams | json | 温度、maxTokens 等参数 |
| capabilityTags | string[] | 员工能力标签（如“前端”、“接口测试”） |
| description | text | 员工简介/备注 |
| status | enum("ACTIVE", "DISABLED") | 启用状态 |
| totalTaskCount | int | 执行任务总数（统计字段，可冗余至表或通过视图计算） |
| lastTaskAt | datetime | 最近任务时间 |
| createdAt/updatedAt | datetime | 记录创建/更新时间 |

### 5.2 AIRoleTemplate

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | 主键 |
| name | string | 模板名称 |
| applicableType | enum("ENGINEER", "QA", "ALL") | 适用员工类型 |
| systemPrompt | text | 系统提示词（整体人格与目标） |
| behaviorGuidelines | json | 行为约束、禁止项、验收标准 |
| toolPermissions | json | 可使用的工具集合定义（代码库、测试框架等） |
| defaultModelProvider | string | 推荐模型提供方 |
| defaultModelName | string | 推荐模型名称 |
| defaultModelParams | json | 推荐模型基础参数 |
| createdBy | string | 创建人 |
| version | int | 模板版本号（用于回滚/历史） |
| createdAt/updatedAt | datetime | 记录时间 |

### 5.3 AITaskAssignment（任务派发记录）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | 派发记录主键 |
| aiEmployeeId | string | 被派发的 AI 员工 |
| projectId | string | 任务所属项目 |
| applicationId | string | 任务绑定的应用/服务 |
| branchName | string | 代码分支 |
| taskTitle | string | 任务标题 |
| taskDescription | text | 任务详情 |
| status | enum("PENDING", "IN_PROGRESS", "SUCCESS", "FAILED") | 当前状态 |
| mock | boolean | 是否由 Mock 服务处理 |
| mockPayload | json | Mock 返回的占位数据（jobId、回执时间等） |
| resultSummary | text | 执行结果摘要 |
| createdAt/updatedAt | datetime | 时间戳 |
| completedAt | datetime | 完成时间（可空） |

任务统计可通过对 `AITaskAssignment` 聚合，为列表提供 `totalTaskCount` 与 `lastTaskAt` 等字段。

## 6. API 设计（首期包含 Mock）

| 接口 | 方法 | 描述 |
| --- | --- | --- |
| `/api/ai-role-templates` | GET | 分页查询角色模板（支持按类型过滤）。 |
| `/api/ai-role-templates` | POST | 新增模板。 |
| `/api/ai-role-templates/{id}` | PATCH | 更新模板，支持版本号控制。 |
| `/api/ai-employees` | GET | 查询 AI 员工列表/详情（支持类型、状态、关键字过滤）。 |
| `/api/ai-employees` | POST | 创建 AI 员工。 |
| `/api/ai-employees/{id}` | PATCH | 更新员工信息（含启用/停用）。 |
| `/api/ai-employees/{id}/tasks` | GET | 查询员工任务历史（分页）。 |
| `/api/ai-employees/{id}/dispatch` | POST | 派发任务给指定员工（首期 Mock）。 |

### `/api/ai-employees/{id}/dispatch` 请求/响应示例

**Request**
```json
{
  "projectId": "proj_123",
  "applicationId": "app_web",
  "branch": "feature/login-flow",
  "taskTitle": "修复登录页按钮样式",
  "taskDescription": "请检查登陆页主按钮的 CSS 问题并提交 PR",
  "expectedOutputs": ["commit", "test report"],
  "priority": "HIGH"
}
```

**Mock Response**
```json
{
  "status": "accepted",
  "taskId": "mock-task-20241112-001",
  "message": "任务已进入 AI 员工队列（Mock）"
}
```

- 首期 Mock 实现：后端直接返回成功响应，并在 `AITaskAssignment` 中记录一条状态为 `IN_PROGRESS` 的任务，使用定时任务/假数据模拟状态更新。
- 后续真实对接：调用任务编排服务（如 AgentHub），根据 AI 员工的角色模板与模型配置构建执行上下文。

## 7. 前端页面与交互规划

1. **AI 员工列表页**
   - 顶部：统计概览（员工总数、活跃员工数、本周任务数）。
   - 列表：
     - 列：名称、类型、模板、执行任务数、最近任务时间、状态、操作。
     - 操作：查看详情、派发任务、停用。
   - 支持条件筛选与关键字搜索。

2. **新增/编辑员工弹窗或页面**
   - 基础信息 + 模型配置 + 角色模板选项卡。
   - 选用模板时可预览模板内容；若选“新建模板”则展开模板表单。

3. **角色模板管理页**
   - 列表展示模板名称、适用类型、引用员工数、更新时间。
   - 支持查看详情、复制、编辑、禁用。

4. **员工详情页**
   - 展示基础信息、关联模板（可跳转查看）。
   - 任务记录列表（含状态、项目、分支、执行时间、结果）。
   - 派发任务入口。

5. **派发任务弹窗**
   - 步骤式（Step Form）：选择员工 → 选择项目/应用/分支 → 填写任务。
   - 提交后显示 Mock 成功提示和任务 ID，支持跳转到任务详情。

## 8. 权限与审计

- 权限模型：
  - "AI 模块管理员"：可管理模板与员工，查看所有任务。
  - "任务派发者"：可查看员工、派发任务，但不可修改模板。
  - "观察者"：仅可查看列表与任务状态。
- 审计日志：
  - 记录模板新增/修改、员工新增/启停、任务派发与状态变更。
  - 可复用现有审计模块或新增 `AuditLog` 事件类型。

## 9. 技术实现要点

- **后端服务层**：
  - `aiEmployeeSvc`: 负责员工 CRUD、列表聚合、统计。
  - `aiRoleTemplateSvc`: 管理角色模板与版本。
  - `aiTaskDispatchSvc`: 负责派发、Mock 结果模拟、未来对接真实任务编排。
- **数据存储**：
  - 使用 Prisma 定义模型，同步生成迁移。
  - `totalTaskCount` 和 `lastTaskAt` 可通过数据库视图或定时批处理更新，避免实时聚合压力。
- **Mock 实现**：
  - `dispatch` 接口提交后写入 `AITaskAssignment`，使用计划任务（cron）或后台 worker 每隔固定时间将状态从 `IN_PROGRESS` 改为 `SUCCESS` 并写入示例输出。
  - 保留 Mock 标识，便于后续替换为真实执行服务。
- **系统配置**：
  - 可利用现有 `systemConfigSvc` 存储默认模型配置、模板策略开关等全局配置项。

### 9.1 任务执行器设计

#### 设计目标
- 支持按照员工维度管理任务排队与并发度，确保单个员工的任务默认串行执行，可按需配置并发上限。
- 在同一集群内实现任务执行环境的隔离，保障代码、凭证与产出的安全，满足“工作区间”划分需求。
- 具备弹性伸缩能力，可根据任务压力动态增加或释放算力，避免为每位员工长期保留闲置资源。
- 提供完整的生命周期管理与可观测性，便于追踪执行日志、资源使用与失败重试情况。

#### 架构概览
- **Executor Orchestrator（控制平面）**：常驻服务，订阅 `AITaskAssignment` 的状态变更，将任务放入消息队列或任务流（建议选用 Redis Stream/BullMQ 或 Kafka Topic，按员工 ID 分区）。负责下发执行指令、记录执行上下文。
- **Per-Employee Queue 管理**：逻辑上为每位员工维护一个待执行队列，并通过分布式锁或队列分组保障串行执行；并发度配置存储在员工配置中，可在 Orchestrator 层读取并据此控制并行 pod 数。
- **Workspace Manager**：负责为任务划分工作区间。每次执行创建独立的工作目录（基于对象存储 + 临时 PVC），根据任务类型决定是临时工作区还是可复用缓存。
- **Kubernetes Runtime Adapter**：将执行请求转换为 K8s Job/Pod 描述，注入运行镜像、环境变量、挂载卷、ServiceAccount 等。支持预热镜像与资源配额策略。
- **结果回写与观测**：执行容器通过 gRPC / Webhook / 日志 Sidecar 向 Orchestrator 上报进度，最终写回 `AITaskAssignment` 的状态与产出元数据。

#### Kubernetes 运行模型
- **按需启动而非常驻容器**：为避免资源浪费，不为每个员工长时间维持独立容器。Orchestrator 在任务出队时动态创建 K8s Job/Pod，任务完成后 Pod 自动销毁。若存在对实时响应的高要求，可对特定员工启用“热身池”（预创建待命 Pod）。
- **执行镜像与模板**：统一基础镜像（内置 Git、语言运行时、Agent SDK），再通过 ConfigMap/环境变量加载具体员工的角色模板、模型配置、凭证等。
- **工作区间隔离**：每个 Job 默认挂载独立的 PVC 或使用 Ephemeral Volume，并通过命名规则区分：`/workspaces/{employeeId}/{taskId}`。可配置是否在任务间复用缓存（例如依赖下载目录）。
- **资源与权限控制**：根据员工类型设置 requests/limits、节点选择器、PodSecurityContext；通过 ServiceAccount 绑定所需的 K8s 或外部资源权限。

#### 任务调度与生命周期
1. `aiTaskDispatchSvc` 创建任务记录，状态置为 `PENDING`。
2. Orchestrator 将任务写入消息队列的员工分区，并尝试获取对应的执行许可（默认单许可）。
3. 获得许可后，创建 Workspace，并生成 K8s Job。任务状态更新为 `IN_PROGRESS`。
4. 执行容器启动后加载上下文（代码仓、模板、历史产物等），通过标准化 Runner 执行脚本或指令。
5. 执行过程中输出的日志通过日志收集器或 Websocket 回传，写入 `AITaskAssignment.mockPayload` / 结果表。
6. 成功完成或失败退出后，Runner 将结果写回存储，并通过回调/事件通知 Orchestrator，更新状态为 `SUCCESS` 或 `FAILED`，记录 `resultSummary` 与产出链接。
7. Orchestrator 释放员工的执行许可，若队列中仍有待办任务则继续第 2 步。

#### 异常处理与重试
- 对于可重试的错误（网络抖动、依赖安装失败等）按配置进行指数退避重试，重试信息写入 `mockPayload`。超过上限则标记为 `FAILED` 并触发告警。
- Pod 层采用 TTL Controller，失败任务保留 Pod 以供排查；成功任务在短暂保留后自动清理。
- Orchestrator 支持手动“重新执行”指令，复用原任务的上下文生成新 Job。

#### 可观测性与审计
- 统一采集执行指标（执行时长、资源占用、失败率）写入监控系统（Prometheus + Grafana）。
- 结合审计模块记录调度决策、资源申请、结果回写等关键事件。
- 对接日志平台，实现按员工、任务、Pod 维度的检索。

#### 安全与合规
- 执行镜像经过安全扫描，限制 root 权限，必要时启用 gVisor/Containerd 的额外隔离。
- Workspace 中的敏感凭证通过密文挂载（K8s Secret + SOPS），并在任务完成后立即销毁或失效。
- 支持按照项目或环境划分命名空间，实现更细粒度的网络与资源隔离，满足“区分工作区间”的需求。

## 10. 迭代计划

| 迭代 | 范围 | 交付物 |
| --- | --- | --- |
| Phase 0 | 设计阶段 | 完成数据模型、接口、交互方案评审（当前文档）。 |
| Phase 1 | 基础管理 | 实现模板管理 + 员工 CRUD + 列表统计（含 Mock 数据）。 |
| Phase 2 | 任务派发（Mock） | 完成派发表单、Mock 接口、任务记录展示，提供基础审计日志。 |
| Phase 3 | 真是执行集成 | 对接真实 Agent 工作流、结果回写与通知，增强权限控制与监控。 |
| Phase 4 | 优化 | 引入任务 SLA、工时统计、智能推荐员工等高级特性。 |

## 11. 风险与待确认项

1. **模板更新影响范围**：模板变更是否自动同步至关联员工，需要明确规则与提示策略。
2. **项目/应用来源数据**：需确认现有系统是否已维护统一的项目/应用/分支元数据接口。
3. **任务执行资源**：真实执行阶段需评估 Agent 的额度、算力配置以及并发控制方案。
4. **安全合规**：不同类型任务可能涉及源代码、测试数据，需要在权限与审计层面加强约束。
5. **多 Agent 协作**：未来若需要多个 AI 员工协作完成同一任务，需提前考虑任务编排模型。

---

本设计文档用于指导 AI 员工模块的产品与技术实现，后续可根据评审结果持续更新迭代。