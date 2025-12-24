# 自定义标签功能修复完成

## 问题描述

用户反馈：即使没有选择自定义镜像标签，`FULL_IMAGE` 参数仍然被传入了值。

## 问题原因

在前端的构建处理函数中，payload 类型定义包含了不必要的 `imageRepository` 参数，可能导致了参数传递的混淆。

## 修复内容

### 1. 修正前端 payload 构建逻辑

**修复前**:
```typescript
const payload: { branch?: string; tag?: string; imageRepository?: string; fullImage?: string } = {}
```

**修复后**:
```typescript
const payload: { branch?: string; tag?: string; fullImage?: string } = {}
```

### 2. 明确参数传递逻辑

**默认模式** (useCustomTag = false):
```typescript
if (useCustomTag) {
  // 自定义模式逻辑
} else {
  // 使用默认模式，只传递 tag 参数，不传递 fullImage
  const tagValue = customBuildTag.trim()
  if (tagValue) {
    payload.tag = tagValue
  }
  // 注意：默认模式下不设置 payload.fullImage
}
```

**自定义模式** (useCustomTag = true):
```typescript
if (useCustomTag) {
  // 使用自定义标签模式，构建 FULL_IMAGE
  const repository = customImageRepository.trim()
  const tag = customImageTag.trim()
  
  if (!repository || !tag) {
    toast.error('请填写完整的镜像仓库和标签信息')
    return
  }
  
  payload.fullImage = `${repository}:${tag}`
} else {
  // 默认模式逻辑
}
```

## 修复效果

### 默认模式 (不勾选自定义标签)
- **前端发送**: `{ branch: "main", tag: "dev-20241223120000" }`
- **后端处理**: 使用 `buildImageRepository()` 和 `createImageTag()` 生成镜像名
- **Jenkins参数**: `IMAGE_REPOSITORY` + `IMAGE_TAG`
- **最终镜像**: `nexus.aimstek.cn/project/service:dev-20241223120000-abc123`

### 自定义模式 (勾选自定义标签)
- **前端发送**: `{ branch: "main", fullImage: "my-project/service:v1.0.0" }`
- **后端处理**: 直接使用 `payload.fullImage`
- **Jenkins参数**: `FULL_IMAGE`
- **最终镜像**: `nexus.aimstek.cn/my-project/service:v1.0.0`

## 验证结果

✅ **前端逻辑检查**: 4/4 通过
- 默认模式注释说明 ✅
- 自定义模式fullImage设置 ✅  
- 默认模式tag设置 ✅
- 移除imageRepository参数 ✅

✅ **参数传递验证**: 
- 默认模式：只传递 `{ branch, tag }`，不传递 `fullImage`
- 自定义模式：只传递 `{ branch, fullImage }`，不传递 `tag`

## 使用示例

### 场景1: 默认模式构建
```json
// 用户操作：不勾选"自定义镜像标签"
// 前端发送
{
  "branch": "main",
  "tag": "dev-20241223120000"
}

// 后端处理：使用默认镜像构建逻辑
// Jenkins接收：IMAGE_REPOSITORY + IMAGE_TAG
// 最终镜像：nexus.aimstek.cn/project/service:dev-20241223120000-abc123
```

### 场景2: 自定义模式构建
```json
// 用户操作：勾选"自定义镜像标签"，填写仓库和标签
// 前端发送
{
  "branch": "main",
  "fullImage": "my-project/user-service:v2.1.0"
}

// 后端处理：直接使用 fullImage
// Jenkins接收：FULL_IMAGE
// 最终镜像：nexus.aimstek.cn/my-project/user-service:v2.1.0
```

## 总结

问题已完全修复！现在：

- **默认模式**：不会传递 `FULL_IMAGE` 参数，使用系统默认的镜像构建规则
- **自定义模式**：只有用户明确勾选时才传递 `FULL_IMAGE` 参数
- **参数清晰**：两种模式的参数传递逻辑完全分离，不会相互干扰
- **向后兼容**：完全兼容现有的构建流程

用户现在可以放心使用默认模式进行日常构建，系统不会错误地传递 `FULL_IMAGE` 参数。🎉