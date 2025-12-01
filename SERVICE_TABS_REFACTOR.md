# 服务详情页标签页重构

## 概述

将服务详情页的配置标签页拆分为多个独立标签页，提供更便捷的配置管理体验。

## 变更内容

### 新增标签页

1. **环境变量** (`environment`)
   - 独立的环境变量配置页面
   - 支持快速编辑和保存
   - 保存后自动重启服务

2. **网络** (`network`)
   - 独立的网络配置页面
   - 包含服务类型、端口映射、域名配置
   - 支持快速编辑和部署

### 调整后的标签页结构

现在服务详情页包含 8 个标签页（原来是 6 个）：

1. **概览** - 服务状态、资源监控、事件
2. **配置** - 基础配置、卷挂载、资源限制、数据库配置
3. **环境变量** - 环境变量管理（新增）
4. **网络** - 网络和域名配置（新增）
5. **部署** - 部署历史和镜像管理
6. **日志** - 实时日志查看
7. **文件** - 文件管理
8. **YAML** - Kubernetes 配置预览

## 技术实现

### 新增文件

- `src/components/services/EnvironmentTab.tsx` - 环境变量标签页组件
- `src/components/services/NetworkTab.tsx` - 网络配置标签页组件

### 修改文件

- `src/types/service-tabs.ts` - 添加新的标签页类型定义
- `src/lib/service-tab-config.ts` - 更新标签页配置
- `src/lib/service-tab-utils.ts` - 更新标签页工具函数
- `src/components/services/ConfigurationTab.tsx` - 移除环境变量和网络配置部分
- `src/components/services/LazyTabComponents.tsx` - 添加新标签页的懒加载
- `src/app/projects/[id]/services/[serviceId]/page.tsx` - 添加新标签页内容
- `src/lib/__validation__/service-tab-config.validation.ts` - 更新验证逻辑

## 用户体验改进

### 优势

1. **更快的访问** - 常用配置（环境变量、网络）可以直接访问，无需在大的配置页面中滚动查找
2. **更清晰的组织** - 每个标签页专注于特定的配置类型
3. **更好的性能** - 使用懒加载，只在需要时加载标签页内容
4. **独立的编辑流程** - 每个标签页有自己的编辑/保存/取消按钮，互不干扰

### 使用场景

- **快速修改环境变量** - 直接进入"环境变量"标签页，编辑并保存重启
- **快速配置网络** - 直接进入"网络"标签页，修改端口或域名配置
- **完整配置管理** - 在"配置"标签页查看和修改基础配置、卷挂载等

## 向后兼容

- 保留了旧的标签页值的迁移逻辑
- URL 参数中的旧标签页值会自动转换为新的标签页值
- 不影响现有的功能和数据

## 测试

运行验证脚本确认所有服务类型都显示正确的标签页：

```bash
npx ts-node src/lib/__validation__/service-tab-config.validation.ts
```

预期结果：所有服务类型（Application、Database、Image）都应该显示 8 个标签页。
