# Implementation Plan

- [x] 1. 更新类型定义和数据模型
  - 在 `src/types/project.ts` 中定义新的 `MultiDebugConfig` 和 `DebugToolConfig` 接口
  - 保留 `LegacyDebugConfig` 类型用于向后兼容
  - 定义前端使用的 `DebugToolDefinition` 和 `DebugToolPreset` 类型
  - _Requirements: 1.2, 5.1_

- [x] 2. 实现核心验证和转换工具函数
  - 创建 `src/lib/debug-tools-utils.ts` 文件
  - 实现 `validateDockerImage()` - 验证 Docker 镜像地址格式
  - 实现 `validateMountPath()` - 验证挂载路径格式
  - 实现 `validateUniquePaths()` - 验证路径唯一性
  - 实现 `validateDebugConfig()` - 完整配置验证
  - 实现 `isLegacyConfig()` - 检测旧配置格式
  - 实现 `convertLegacyToMultiConfig()` - 转换旧配置到新格式
  - 实现 `normalizeDebugConfig()` - 统一配置规范化入口
  - _Requirements: 2.5, 5.1, 5.2, 6.1, 6.2, 6.3_

- [ ]* 2.1 为验证函数编写属性测试
  - **Property 3: Path validation correctness**
  - **Property 11: Docker image address validation**
  - **Property 12: Path uniqueness validation**
  - **Validates: Requirements 2.5, 6.1, 6.2, 6.3**

- [ ]* 2.2 为转换函数编写属性测试
  - **Property 10: Legacy config conversion preserves semantics**
  - **Validates: Requirements 5.1, 5.2**

- [x] 3. 实现 Kubernetes 配置生成函数
  - 在 `src/lib/debug-tools-utils.ts` 中添加生成函数
  - 实现 `generateDebugInitContainers()` - 生成 Init Container 配置数组
  - 实现 `generateDebugVolumes()` - 生成 emptyDir 卷配置数组
  - 实现 `generateUsageInstructions()` - 生成使用说明文本
  - 确保 Init Container 顺序稳定（按 toolset 字母顺序）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3_

- [ ]* 3.1 为 Kubernetes 生成函数编写属性测试
  - **Property 4: Init Container count matches tool count**
  - **Property 5: Volume count matches tool count**
  - **Property 6: Mount path consistency**
  - **Property 7: Init Container order stability**
  - **Property 8: Custom image mapping**
  - **Property 9: Usage instructions completeness**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.3**

- [x] 4. 创建前端子组件
  - 创建 `src/components/services/debug-tools/DebugToolCard.tsx` - 单个工具选择卡片
  - 创建 `src/components/services/debug-tools/QuickPresetSelector.tsx` - 快速配置预设选择器
  - 创建 `src/components/services/debug-tools/UsageInstructions.tsx` - 使用说明组件
  - 实现工具定义常量 `TOOL_DEFINITIONS` 和预设常量 `QUICK_PRESETS`
  - _Requirements: 1.1, 4.1, 4.2, 7.1, 7.2_

- [ ]* 4.1 为子组件编写单元测试
  - 测试 DebugToolCard 的选择和配置功能
  - 测试 QuickPresetSelector 的预设应用
  - 测试 UsageInstructions 的内容生成
  - _Requirements: 1.1, 4.1, 4.2, 7.1, 7.2_

- [x] 5. 重构 DebugToolsSection 组件支持多选
  - 更新 `src/components/services/configuration/DebugToolsSection.tsx`
  - 将单选 RadioGroup 改为多个 DebugToolCard 复选框
  - 集成 QuickPresetSelector 组件
  - 实现工具选择状态管理（使用 Set 和 Map）
  - 实现实时验证和错误提示
  - 集成 UsageInstructions 组件
  - 处理向后兼容（自动转换旧配置）
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 4.3, 4.4, 4.5, 5.5, 6.4, 7.3, 7.4, 7.5_

- [ ]* 5.1 为 DebugToolsSection 编写属性测试
  - **Property 1: Tool combination acceptance**
  - **Property 2: Configuration persistence round trip**
  - **Property 13: Valid configuration saves successfully**
  - **Property 14: Preset application correctness**
  - **Validates: Requirements 1.2, 1.3, 6.5, 7.3**

- [ ]* 5.2 为 DebugToolsSection 编写集成测试
  - 测试用户选择多个工具的完整流程
  - 测试快速预设功能
  - 测试错误提示显示
  - 测试向后兼容场景
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.5, 6.3, 6.4, 7.3_

- [x] 6. 更新后端 API 支持新配置格式
  - 更新 `src/app/api/services/[id]/route.ts` 的 PUT 处理器
  - 确保正确保存和读取 `debug_config` JSON 字段
  - 添加服务端配置验证（可选，前端已验证）
  - _Requirements: 1.3, 5.3_

- [ ]* 6.1 为 API 编写集成测试
  - 测试保存新格式配置
  - 测试读取旧格式配置并自动转换
  - 测试错误处理
  - _Requirements: 1.3, 5.1, 5.3_

- [x] 7. 集成到 Kubernetes 部署流程
  - 找到生成 Kubernetes Deployment YAML 的代码位置
  - 集成 `generateDebugInitContainers()` 和 `generateDebugVolumes()`
  - 确保 Init Containers 和 Volumes 正确添加到 Deployment spec
  - 测试部署流程（手动测试或自动化测试）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 7.1 为 Kubernetes 集成编写端到端测试
  - 测试从配置到部署的完整流程
  - 验证生成的 Kubernetes 资源正确性
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. 更新文档和用户指南
  - 更新 `doc/项目管理使用指南.md` 添加多调试工具配置说明
  - 添加快速配置预设的使用说明
  - 添加常见问题和故障排除
  - _Requirements: 4.1, 4.3, 4.4, 7.2_

- [ ] 9. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户
