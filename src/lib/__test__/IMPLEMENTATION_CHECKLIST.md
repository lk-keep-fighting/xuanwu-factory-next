# Task 2 Implementation Checklist

## Task Requirements
- [x] 创建 `src/lib/debug-tools-utils.ts` 文件
- [x] 实现 `validateDockerImage()` - 验证 Docker 镜像地址格式
- [x] 实现 `validateMountPath()` - 验证挂载路径格式
- [x] 实现 `validateUniquePaths()` - 验证路径唯一性
- [x] 实现 `validateDebugConfig()` - 完整配置验证
- [x] 实现 `isLegacyConfig()` - 检测旧配置格式
- [x] 实现 `convertLegacyToMultiConfig()` - 转换旧配置到新格式
- [x] 实现 `normalizeDebugConfig()` - 统一配置规范化入口

## Requirements Coverage

### Requirement 2.5 (Path Validation)
- [x] `validateMountPath()` validates paths start with `/`
- [x] `validateMountPath()` validates paths contain only valid characters (alphanumeric, -, _, /, .)
- [x] `validateMountPath()` rejects root path `/`

### Requirement 5.1 (Legacy Config Detection)
- [x] `isLegacyConfig()` detects old single-tool format
- [x] `isLegacyConfig()` checks for enabled, toolset, mountPath fields
- [x] `isLegacyConfig()` rejects multi-tool format

### Requirement 5.2 (Legacy Config Conversion)
- [x] `convertLegacyToMultiConfig()` preserves enabled status
- [x] `convertLegacyToMultiConfig()` preserves toolset
- [x] `convertLegacyToMultiConfig()` preserves mountPath
- [x] `convertLegacyToMultiConfig()` preserves customImage
- [x] `convertLegacyToMultiConfig()` creates empty tools array when disabled

### Requirement 6.1 (Docker Image Validation)
- [x] `validateDockerImage()` accepts simple image names (e.g., busybox)
- [x] `validateDockerImage()` accepts image:tag format
- [x] `validateDockerImage()` accepts registry/image:tag format
- [x] `validateDockerImage()` accepts registry:port/image:tag format
- [x] `validateDockerImage()` accepts image@sha256:digest format
- [x] `validateDockerImage()` rejects invalid formats (uppercase, spaces, etc.)

### Requirement 6.2 (Path Format Validation)
- [x] `validateDebugConfig()` validates all mount paths
- [x] `validateDebugConfig()` reports invalid path errors with descriptive messages

### Requirement 6.3 (Path Uniqueness Validation)
- [x] `validateUniquePaths()` detects duplicate paths
- [x] `validateDebugConfig()` includes uniqueness check
- [x] `validateDebugConfig()` reports duplicate path errors

### Additional Validation (from design)
- [x] `validateDebugConfig()` validates custom tools have image addresses
- [x] `validateDebugConfig()` validates custom image format
- [x] `validateDebugConfig()` requires at least one tool when enabled
- [x] `validateDebugConfig()` accepts null/undefined configs
- [x] `validateDebugConfig()` accepts disabled configs

### Normalization (from design)
- [x] `normalizeDebugConfig()` handles null/undefined
- [x] `normalizeDebugConfig()` converts legacy configs
- [x] `normalizeDebugConfig()` passes through multi-tool configs
- [x] `normalizeDebugConfig()` handles unknown formats with warning

## Implementation Quality

### Code Quality
- [x] All functions have JSDoc comments
- [x] Type safety with TypeScript
- [x] Proper error handling
- [x] Clear function names
- [x] Single responsibility principle

### Error Messages
- [x] Chinese error messages as per design
- [x] Descriptive error messages
- [x] Multiple errors collected in validation

### Edge Cases Handled
- [x] null/undefined inputs
- [x] Empty arrays
- [x] Non-string/non-array inputs
- [x] Disabled configurations
- [x] Unknown configuration formats

## Files Created
1. `src/lib/debug-tools-utils.ts` - Main implementation (✅ No TypeScript errors)
2. `src/lib/__test__/debug-tools-utils.test.ts` - Unit tests (ready for vitest)
3. `src/lib/__test__/debug-tools-utils-verify.ts` - Manual verification script (✅ No TypeScript errors)

## Next Steps
- Task 2.1 (optional): Property-based tests - NOT IMPLEMENTED (marked with *)
- Task 2.2 (optional): Property-based tests for conversion - NOT IMPLEMENTED (marked with *)
- Task 3: Implement Kubernetes configuration generation functions
