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

### 9.1 任务执行器设计（MVP，长驻容器）

#### MVP 目标
- 让每位 AI 员工的任务在 Kubernetes 中按员工维度排队串行执行，并可配置并发上限。
- 避免频繁拉起短生命周期容器，复用同一工作空间以减少代码拉取与依赖安装成本。
- 提供最小可用的运行与观测能力，便于追踪任务状态、日志与产物。

#### 核心组件
1. **调度器（ai-task-executor-scheduler）**：以 Deployment 形式常驻，订阅 `AITaskAssignment`，按照员工 ID 将任务写入 Redis/BullMQ 队列。调度器负责分配执行令牌，并为每位员工维护独立的队列与并发度配置。
2. **执行器注册中心（Executor Registry）**：调度器内置或独立服务，维护员工到执行容器的映射，记录每个长驻 Pod 的运行状态、可用槽位以及绑定的工作区。
3. **长驻执行容器（Executor Worker）**：以 StatefulSet/Deployment 部署，每个 Pod 绑定一个员工（或一个并发槽位），持续从对应队列拉取任务。容器内运行统一的 `executor-agent`，负责加载任务上下文并执行指令。
4. **工作区管理（Workspace Manager）**：为每个员工创建持久 PVC（`workspace-{employeeId}`），在首次任务后保留仓库代码与依赖。任务完成后仅清理临时目录，保留可复用的缓存。

#### 任务执行流程
1. 派发任务写入 `AITaskAssignment`，状态置为 `PENDING`，并发布到消息队列。
2. 调度器监听队列，将任务排入员工专属的待执行队列，检查目标员工的执行容器是否在线且有空闲槽位。
3. 长驻执行容器通过心跳与拉取请求向调度器申请任务；调度器授予执行许可并返回任务上下文（包含项目、分支、模板、模型配置等）。
4. 执行容器在自身挂载的 PVC 中准备工作区：首次任务执行时克隆项目仓库并初始化依赖；后续任务只需切换分支或拉取最新代码。
5. 容器内的 `executor-agent` 执行标准脚本，期间输出日志到 stdout，并可将中间产物写入对象存储或 PVC。
6. 任务完成后，`executor-agent` 汇总结果并调用调度器/后端 API 更新 `AITaskAssignment` 为 `SUCCESS` 或 `FAILED`，记录 `resultSummary`、产物链接与执行指标。
7. 容器释放槽位，再次进入待命状态，等待下一个任务；若检测到错误或异常退出，调度器可自动拉起新的 Pod 并重建工作区。

#### 资源与隔离策略
- **长驻但弹性**：默认每位员工对应 1 个执行 Pod，可根据并发需求水平扩展。Pod 闲置时仍保持运行，但可通过 HPA 基于队列长度或心跳自动伸缩。
- **工作区复用**：PVC 与容器生命周期解耦，重建 Pod 时重新挂载原 PVC，确保代码与依赖缓存被保留；对不同项目可在 PVC 内划分子目录。
- **权限控制**：每个执行 Pod 使用独立 ServiceAccount 与命名空间策略，仅允许访问对应项目所需资源。敏感凭证通过 Secret/ConfigMap 注入。

#### 观测与运维
- `AITaskAssignment` 增加 `startedAt`、`finishedAt`、`executorId` 字段，用于追踪执行耗时与容器映射。
- 调度器暴露 Prometheus 指标（队列长度、执行耗时、失败率、Pod 在线数）。
- 日志统一输出至 stdout，配合 Loki/ELK 可按员工或任务维度检索；执行容器可在任务结束时上传关键日志片段至对象存储。
- 提供手动干预接口：可下线某个执行容器、清理工作区或触发任务重试。

#### 后续扩展方向
- 动态调整执行容器与员工的绑定关系，支持同一容器处理多个员工但保持工作区隔离。
- 引入任务优先级、超时与自动重试策略，以及多容器协同执行能力。
- 增强工作区管理（缓存策略、快照、差异回滚）与安全隔离（gVisor/Pod Sandbox）。
- 深化可观测性：纳入资源用量、文件 I/O 指标，并与审计系统联动生成执行报告。

### 9.2 全流程系统架构设计

#### 系统组成
- **前端（Web Console）**：提供员工管理、模板配置、任务派发 UI，调用后端 API。
- **API Gateway / BFF**：统一鉴权、租户隔离，将请求路由至核心服务。
- **aiEmployeeSvc**：负责 AI 员工 CRUD、状态同步与统计汇总，使用 Prisma 与数据库交互。
- **aiRoleTemplateSvc**：维护角色模板、版本与行为约束，向员工管理与执行器提供模板内容。
- **aiTaskDispatchSvc**：处理任务派发请求，校验上下文信息，写入 `AITaskAssignment` 并触发事件。
- **消息队列（Redis Stream / BullMQ）**：承载按员工分片的任务队列，保证顺序与并发度控制。
- **ai-task-executor 调度器**：部署在后端集群中，监听任务队列并协调长驻执行容器，从调度层面控制并发与资源使用。
- **ai-task-executor Worker Pool**：以 StatefulSet/Deployment 形式部署的长驻执行容器集群，按照员工 ID 或并发槽位绑定工作区并持续消费任务。
- **Kubernetes 集群**：作为执行平面，托管调度器与执行容器，挂载工作区 PVC，并接入日志/监控系统。
- **对象存储 / 产物仓库**：保存执行产出（日志附件、补丁、报告），通过任务记录引用。
- **观测与审计系统**：Prometheus/Grafana 收集指标，现有审计模块记录关键操作。

#### 端到端流程
1. **AI 员工管理**
   - 管理端通过 Web Console 发起新增或编辑请求，API Gateway 转发至 `aiEmployeeSvc`。
   - `aiEmployeeSvc` 基于 Prisma 写入数据库，并与 `aiRoleTemplateSvc` 同步模板引用。
   - 更新后通过事件总线或缓存刷新机制通知调度器，以便其获取最新的并发度、模板参数。

2. **任务创建与派发**
   - 用户选择员工、项目、分支并填写任务描述，前端调用 `aiTaskDispatchSvc`。
   - `aiTaskDispatchSvc` 校验员工状态、上下文合法性，写入 `AITaskAssignment` 记录，状态置为 `PENDING`。
   - 同时生成派发事件（如发布到 Redis Stream），包含任务 ID、员工 ID、执行配置等。

3. **任务执行器工作流**
   - `ai-task-executor` 调度器订阅事件，将任务写入对应员工的队列，并依据并发限制授予执行令牌。
   - 长驻执行容器通过心跳与拉取接口向调度器获取任务，首次获取时挂载或初始化员工专属 PVC，并拉取项目代码。
   - 执行容器在本地工作区内切换至目标分支，加载角色模板、模型配置与凭证，运行标准化 `executor-agent` 完成任务。
   - 执行过程中日志通过 stdout 输出并被日志系统采集，产物上传至对象存储或写入 PVC 后回填到 `AITaskAssignment`。
   - 任务结束后，执行容器回写状态与指标，释放槽位等待下一任务；失败任务根据策略进入重试队列或等待人工处理。

#### 与现有系统的集成
- 后端服务共用现有的身份鉴权、租户隔离与系统配置中心，避免重复建设。
- 数据层沿用当前数据库实例与 Prisma 迁移体系，`AITaskAssignment` 作为主表与员工、项目等实体通过外键关联。
- 消息队列与缓存复用平台已有的 Redis 集群，新增命名空间以隔离 AI 员工调度数据。
- 监控与日志遵循现有 Observability 方案（Prometheus、Grafana、Loki/ELK），方便纳入统一运维视角。
- 审计日志扩展当前 `AuditLog` 机制，记录员工新增/修改、任务派发、任务状态变更及执行器告警。

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