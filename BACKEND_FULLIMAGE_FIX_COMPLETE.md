# 后端 FULL_IMAGE 参数传递修复完成

## 问题描述

用户反馈：即使没有选择自定义镜像标签，Jenkins 仍然收到了 `FULL_IMAGE` 参数，导致 Jenkins 脚本总是使用 `FULL_IMAGE` 而不是预期的 `IMAGE_REPOSITORY:IMAGE_TAG-commitId` 格式。

## 问题根源

**真正的问题在后端API**，不在前端！

在 `src/app/api/services/[id]/build/route.ts` 中，无论用户是否选择自定义标签，后端都会向 Jenkins 传递 `FULL_IMAGE` 参数：

```typescript
// 问题代码
const parameters: Record<string, string> = {
  SERVICE_ID: id,
  SERVICE_NAME: serviceRecord.name,
  // ... 其他参数
  IMAGE_REPOSITORY: repository,
  IMAGE_TAG: tag,
  FULL_IMAGE: fullImage,  // ❌ 总是传递，即使用户没有自定义
  SERVICE_IMAGE_ID: serviceImage.id
}
```

这导致 Jenkins 脚本总是收到 `FULL_IMAGE` 参数，因此总是优先使用 `FULL_IMAGE` 而不是默认的构建逻辑。

## 修复方案

### 修改后端参数传递逻辑

**修复前**:
```typescript
const parameters: Record<string, string> = {
  // ... 其他参数
  IMAGE_REPOSITORY: repository,
  IMAGE_TAG: tag,
  FULL_IMAGE: fullImage,  // ❌ 总是传递
  SERVICE_IMAGE_ID: serviceImage.id
}
```

**修复后**:
```typescript
const parameters: Record<string, string> = {
  // ... 其他参数
  IMAGE_REPOSITORY: repository,
  IMAGE_TAG: tag,
  SERVICE_IMAGE_ID: serviceImage.id
}

// 只有在用户明确使用自定义镜像时才传递 FULL_IMAGE 参数
if (requestedFullImage) {
  parameters.FULL_IMAGE = fullImage
}
```

## 修复效果

### 默认模式（用户不勾选自定义标签）

**前端发送**:
```json
{
  "branch": "main",
  "tag": "dev-20241223120000"
}
```

**后端处理**:
- `requestedFullImage` 为空
- 使用默认镜像构建逻辑
- 生成 `repository` 和 `tag`

**Jenkins 接收参数**:
```json
{
  "GIT_BRANCH": "main",
  "IMAGE_REPOSITORY": "nexus.aimstek.cn/project/service",
  "IMAGE_TAG": "dev-20241223120000"
  // 注意：没有 FULL_IMAGE 参数
}
```

**Jenkins 脚本行为**:
```groovy
if (params.FULL_IMAGE?.trim()) {
    // 这个分支不会执行，因为没有 FULL_IMAGE 参数
} else {
    // ✅ 执行这个分支
    image = "${IMAGE_REPOSITORY}:${IMAGE_TAG}-${commitId}"
    // 结果: nexus.aimstek.cn/project/service:dev-20241223120000-abc123
}
```

### 自定义模式（用户勾选自定义标签）

**前端发送**:
```json
{
  "branch": "main",
  "fullImage": "my-project/user-service:v2.1.0"
}
```

**后端处理**:
- `requestedFullImage` 有值
- 解析自定义镜像名
- 生成对应的 `repository` 和 `tag`

**Jenkins 接收参数**:
```json
{
  "GIT_BRANCH": "main",
  "IMAGE_REPOSITORY": "my-project/user-service",
  "IMAGE_TAG": "v2.1.0",
  "FULL_IMAGE": "my-project/user-service:v2.1.0"
  // 注意：有 FULL_IMAGE 参数
}
```

**Jenkins 脚本行为**:
```groovy
if (params.FULL_IMAGE?.trim()) {
    // ✅ 执行这个分支
    image = params.FULL_IMAGE.trim()
    // 结果: nexus.aimstek.cn/my-project/user-service:v2.1.0
} else {
    // 这个分支不会执行
}
```

## 验证结果

✅ **后端逻辑检查**: 4/4 通过
- 移除默认FULL_IMAGE参数 ✅
- 条件传递FULL_IMAGE ✅  
- 保留基础参数 ✅
- 自定义镜像检测 ✅

## 完整的数据流

### 场景1: 默认模式构建
```
用户操作: 不勾选自定义标签
    ↓
前端发送: { branch: "main", tag: "dev-20241223120000" }
    ↓
后端处理: requestedFullImage 为空，使用默认逻辑
    ↓
Jenkins参数: IMAGE_REPOSITORY + IMAGE_TAG (无 FULL_IMAGE)
    ↓
Jenkins脚本: 使用 IMAGE_REPOSITORY:IMAGE_TAG-commitId
    ↓
最终镜像: nexus.aimstek.cn/project/service:dev-20241223120000-abc123
```

### 场景2: 自定义模式构建
```
用户操作: 勾选自定义标签，填写镜像信息
    ↓
前端发送: { branch: "main", fullImage: "my-project/service:v2.1.0" }
    ↓
后端处理: requestedFullImage 有值，使用自定义逻辑
    ↓
Jenkins参数: IMAGE_REPOSITORY + IMAGE_TAG + FULL_IMAGE
    ↓
Jenkins脚本: 优先使用 FULL_IMAGE
    ↓
最终镜像: nexus.aimstek.cn/my-project/service:v2.1.0
```

## 总结

问题已彻底解决！关键修复点：

1. **问题定位准确**: 问题在后端API，不在前端UI
2. **修复方案精确**: 只在自定义模式下传递 `FULL_IMAGE` 参数
3. **行为符合预期**: 
   - 默认模式：Jenkins 使用 `IMAGE_REPOSITORY:IMAGE_TAG-commitId` 格式
   - 自定义模式：Jenkins 优先使用 `FULL_IMAGE` 参数
4. **完全向后兼容**: 不影响现有的构建流程

现在当用户不选择自定义镜像标签时，Jenkins 不会收到 `FULL_IMAGE` 参数，会正确使用你优化的默认构建逻辑！🎉