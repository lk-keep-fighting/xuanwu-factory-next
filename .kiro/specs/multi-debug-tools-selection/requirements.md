# Requirements Document

## Introduction

本需求文档描述了对服务详情页调试工具功能的优化。当前系统仅支持单选一个调试工具集（BusyBox、Netshoot、Ubuntu 或自定义镜像），用户需要在不同场景下切换工具集。优化后的系统将允许用户同时启用多个调试工具，提供更灵活的调试能力，无需在不同工具集之间切换。

## Glossary

- **调试工具 (Debug Tool)**: 通过 Init Container 注入到服务容器中的命令行工具，用于诊断和调试容器内的问题
- **工具集 (Toolset)**: 预定义的调试工具镜像，包含一组特定的命令行工具（如 BusyBox、Netshoot、Ubuntu）
- **Init Container**: Kubernetes 中在主容器启动前运行的初始化容器，用于准备环境或复制文件
- **挂载路径 (Mount Path)**: 调试工具在容器文件系统中的安装位置
- **系统 (System)**: 指本项目管理平台的服务配置功能
- **用户 (User)**: 使用本平台管理 Kubernetes 服务的开发者或运维人员

## Requirements

### Requirement 1

**User Story:** 作为一个开发者，我希望能够同时启用多个调试工具集，这样我可以在一个容器中同时使用轻量级工具和专业网络工具，而不需要在不同工具集之间切换。

#### Acceptance Criteria

1. WHEN 用户访问服务配置页面的调试工具部分 THEN 系统 SHALL 显示可多选的调试工具列表界面
2. WHEN 用户选择多个调试工具 THEN 系统 SHALL 允许同时勾选 BusyBox、Netshoot、Ubuntu 和自定义镜像中的任意组合
3. WHEN 用户保存配置 THEN 系统 SHALL 将所有选中的调试工具配置存储到数据库
4. WHEN 用户取消所有调试工具的选择 THEN 系统 SHALL 禁用调试工具功能
5. WHEN 用户选择自定义镜像 THEN 系统 SHALL 显示自定义镜像输入框并要求填写镜像地址

### Requirement 2

**User Story:** 作为一个运维人员，我希望每个调试工具能够安装到独立的路径，这样不同工具之间不会产生文件冲突，并且我可以清楚地知道每个工具的位置。

#### Acceptance Criteria

1. WHEN 用户选择 BusyBox 工具 THEN 系统 SHALL 将其默认挂载路径设置为 `/debug-tools/busybox`
2. WHEN 用户选择 Netshoot 工具 THEN 系统 SHALL 将其默认挂载路径设置为 `/debug-tools/netshoot`
3. WHEN 用户选择 Ubuntu 工具 THEN 系统 SHALL 将其默认挂载路径设置为 `/debug-tools/ubuntu`
4. WHEN 用户选择自定义镜像 THEN 系统 SHALL 将其默认挂载路径设置为 `/debug-tools/custom`
5. WHEN 用户修改某个工具的挂载路径 THEN 系统 SHALL 允许自定义路径并验证路径格式的有效性

### Requirement 3

**User Story:** 作为一个开发者，我希望系统能够正确生成包含多个 Init Container 的 Kubernetes 配置，这样所有选中的调试工具都能被正确注入到容器中。

#### Acceptance Criteria

1. WHEN 用户启用多个调试工具并部署服务 THEN 系统 SHALL 为每个选中的工具生成一个独立的 Init Container
2. WHEN 系统生成 Init Container 配置 THEN 系统 SHALL 为每个工具创建独立的 emptyDir 卷
3. WHEN 系统生成 Init Container 配置 THEN 系统 SHALL 将每个工具的卷挂载到对应的路径
4. WHEN 系统生成 Init Container 配置 THEN 系统 SHALL 确保 Init Container 的执行顺序是确定的
5. WHEN 用户选择自定义镜像 THEN 系统 SHALL 使用用户提供的镜像地址生成 Init Container

### Requirement 4

**User Story:** 作为一个用户，我希望在界面上能够清楚地看到每个调试工具的信息和使用方法，这样我可以根据需求选择合适的工具组合。

#### Acceptance Criteria

1. WHEN 用户查看调试工具列表 THEN 系统 SHALL 显示每个工具的名称、描述、镜像大小和包含的工具列表
2. WHEN 用户选中某个调试工具 THEN 系统 SHALL 高亮显示该工具的卡片
3. WHEN 用户启用至少一个调试工具 THEN 系统 SHALL 显示使用说明，包含所有已选工具的路径信息
4. WHEN 用户查看使用说明 THEN 系统 SHALL 提供针对多工具场景的 PATH 环境变量配置示例
5. WHEN 用户未选择任何工具 THEN 系统 SHALL 隐藏使用说明部分

### Requirement 5

**User Story:** 作为一个系统管理员，我希望系统能够向后兼容现有的单选调试工具配置，这样已有的服务配置不会因为升级而失效。

#### Acceptance Criteria

1. WHEN 系统读取旧版本的单选调试工具配置 THEN 系统 SHALL 将其转换为新的多选格式
2. WHEN 系统转换旧配置 THEN 系统 SHALL 保留原有的工具类型和挂载路径设置
3. WHEN 系统保存新配置 THEN 系统 SHALL 使用新的数据结构存储多个调试工具
4. WHEN 系统读取没有调试工具配置的服务 THEN 系统 SHALL 显示空的调试工具选择列表
5. WHEN 用户编辑从旧版本迁移的配置 THEN 系统 SHALL 允许添加额外的调试工具

### Requirement 6

**User Story:** 作为一个开发者，我希望系统能够验证我的调试工具配置，这样可以避免因配置错误导致的部署失败。

#### Acceptance Criteria

1. WHEN 用户输入自定义镜像地址 THEN 系统 SHALL 验证镜像地址格式是否符合 Docker 镜像命名规范
2. WHEN 用户输入挂载路径 THEN 系统 SHALL 验证路径是否以 `/` 开头且不包含非法字符
3. WHEN 用户选择多个工具且挂载路径重复 THEN 系统 SHALL 显示错误提示并阻止保存
4. WHEN 用户选择自定义镜像但未填写镜像地址 THEN 系统 SHALL 显示错误提示并阻止保存
5. WHEN 所有配置验证通过 THEN 系统 SHALL 允许保存配置并更新服务

### Requirement 7

**User Story:** 作为一个用户，我希望能够快速启用常用的工具组合，这样可以提高配置效率。

#### Acceptance Criteria

1. WHEN 用户点击"快速配置"按钮 THEN 系统 SHALL 显示预设的工具组合选项
2. WHEN 系统显示预设组合 THEN 系统 SHALL 包含"基础调试"（仅 BusyBox）、"网络诊断"（BusyBox + Netshoot）和"完整工具"（BusyBox + Netshoot + Ubuntu）三个选项
3. WHEN 用户选择某个预设组合 THEN 系统 SHALL 自动勾选对应的调试工具
4. WHEN 用户选择预设组合后 THEN 系统 SHALL 允许用户继续手动调整工具选择
5. WHEN 用户手动修改工具选择 THEN 系统 SHALL 不再显示当前匹配的预设组合名称
