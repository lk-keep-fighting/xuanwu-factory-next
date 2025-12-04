# Task 6 Implementation Summary

## Task: 更新后端 API 支持新配置格式

### Status: ✅ COMPLETED

## Changes Made

### 1. Updated `src/app/api/services/[id]/route.ts`

#### Added Imports
```typescript
import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'
```

#### Enhanced GET Handler
- Automatically normalizes legacy debug_config to multi-tool format when reading from database
- Ensures backward compatibility for existing services with old configuration format

```typescript
// Normalize debug_config for backward compatibility
if (service.debug_config) {
  const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
  service.debug_config = normalizedDebugConfig as Prisma.JsonValue
}
```

#### Enhanced PUT Handler
- Validates debug_config before saving to database
- Normalizes both legacy and multi-tool formats
- Returns detailed error messages for validation failures

```typescript
// Handle debug_config validation and normalization
if (Object.prototype.hasOwnProperty.call(body, 'debug_config')) {
  const rawDebugConfig = body.debug_config
  
  // Normalize the config (handles legacy format conversion)
  const normalizedConfig = normalizeDebugConfig(rawDebugConfig)
  
  // Validate the normalized config
  const validation = validateDebugConfig(normalizedConfig)
  if (!validation.valid) {
    return NextResponse.json(
      { 
        error: '调试工具配置验证失败', 
        details: validation.errors 
      },
      { status: 400 }
    )
  }
  
  // Replace the raw config with the normalized version
  body.debug_config = normalizedConfig as Prisma.JsonValue | null
}
```

### 2. Updated `src/app/api/services/route.ts`

#### Added Imports
```typescript
import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'
```

#### Enhanced GET Handler (List Services)
- Normalizes debug_config for all services in the list
- Ensures consistent format across all API responses

```typescript
// Normalize debug_config for backward compatibility
const normalizedServices = services.map(service => {
  if (service.debug_config) {
    const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
    return {
      ...service,
      debug_config: normalizedDebugConfig as Prisma.JsonValue
    }
  }
  return service
})
```

#### Enhanced POST Handler (Create Service)
- Validates debug_config during service creation
- Normalizes configuration before saving
- Prevents invalid configurations from being created

```typescript
// Handle debug_config validation and normalization
if (Object.prototype.hasOwnProperty.call(body, 'debug_config')) {
  const rawDebugConfig = body.debug_config
  
  // Normalize the config (handles legacy format conversion)
  const normalizedConfig = normalizeDebugConfig(rawDebugConfig)
  
  // Validate the normalized config
  const validation = validateDebugConfig(normalizedConfig)
  if (!validation.valid) {
    return NextResponse.json(
      { 
        error: '调试工具配置验证失败', 
        details: validation.errors 
      },
      { status: 400 }
    )
  }
  
  // Replace the raw config with the normalized version
  body.debug_config = normalizedConfig as Prisma.JsonValue | null
}
```

### 3. Created Test Files

#### `src/app/api/services/[id]/__test__/route.test.ts`
- Unit tests for debug_config handling in API endpoints
- Tests for legacy config normalization
- Tests for multi-tool config validation
- Tests for error handling

#### `src/app/api/services/[id]/__test__/api-verification.md`
- Comprehensive documentation of API behavior
- Example requests and responses
- Validation rules documentation
- Backward compatibility notes

## Requirements Validated

✅ **Requirement 1.3**: WHEN 用户保存配置 THEN 系统 SHALL 将所有选中的调试工具配置存储到数据库
- The PUT and POST handlers save the normalized debug_config to the database

✅ **Requirement 5.1**: WHEN 系统读取旧版本的单选调试工具配置 THEN 系统 SHALL 将其转换为新的多选格式
- The GET handlers automatically convert legacy configs using `normalizeDebugConfig()`

✅ **Requirement 5.2**: WHEN 系统转换旧配置 THEN 系统 SHALL 保留原有的工具类型和挂载路径设置
- The `convertLegacyToMultiConfig()` function preserves all original settings

✅ **Requirement 5.3**: WHEN 系统保存新配置 THEN 系统 SHALL 使用新的数据结构存储多个调试工具
- All configs are normalized to multi-tool format before saving

## API Endpoints Updated

### 1. GET /api/services
- Lists all services with normalized debug_config

### 2. POST /api/services
- Creates new service with validated debug_config

### 3. GET /api/services/[id]
- Returns single service with normalized debug_config

### 4. PUT /api/services/[id]
- Updates service with validated debug_config

## Validation Features

The API now validates:

1. **Mount Path Format**: Must start with `/` and contain only valid characters
2. **Path Uniqueness**: No duplicate mount paths allowed
3. **Custom Image Required**: Custom toolset must have image address
4. **Image Format**: Docker image addresses must be valid
5. **At Least One Tool**: Enabled configs must have at least one tool

## Error Handling

### Validation Errors
Returns 400 status with detailed error messages:
```json
{
  "error": "调试工具配置验证失败",
  "details": [
    "挂载路径不能重复",
    "自定义镜像必须指定镜像地址"
  ]
}
```

### Service Not Found
Returns 404 status:
```json
{
  "error": "服务不存在"
}
```

## Backward Compatibility

✅ **Full backward compatibility maintained**:
- Legacy configs are automatically converted when read
- Both formats accepted when writing
- All configs stored in new format
- No database migration required
- Existing services continue to work

## Testing

### Unit Tests Created
- Legacy config normalization tests
- Multi-tool config validation tests
- Error handling tests
- Edge case tests (null, undefined, invalid formats)

### Existing Tests
All existing tests in `src/lib/__test__/debug-tools-utils.test.ts` pass and validate:
- Validation functions
- Conversion functions
- Kubernetes generation functions

## Notes

1. **No Database Migration Required**: The `debug_config` field is already JSON type in the database, so it can store both old and new formats without schema changes.

2. **Server-Side Validation**: While the frontend also validates, the backend provides an additional layer of validation to ensure data integrity.

3. **Type Safety**: All changes maintain TypeScript type safety with proper Prisma.JsonValue casting.

4. **Pre-existing Issues**: There is a pre-existing type error with `network_config` assignment (line 169 in route.ts) that is unrelated to this task.

## Verification

To verify the implementation:

1. **Create a service with multi-tool config**:
   ```bash
   POST /api/services
   {
     "name": "test-service",
     "project_id": "...",
     "type": "image",
     "image": "nginx",
     "debug_config": {
       "enabled": true,
       "tools": [
         { "toolset": "busybox", "mountPath": "/debug-tools/busybox" },
         { "toolset": "netshoot", "mountPath": "/debug-tools/netshoot" }
       ]
     }
   }
   ```

2. **Update a service with legacy config** (will be auto-converted):
   ```bash
   PUT /api/services/[id]
   {
     "debug_config": {
       "enabled": true,
       "toolset": "busybox",
       "mountPath": "/debug-tools/busybox"
     }
   }
   ```

3. **Get a service** (legacy configs will be normalized):
   ```bash
   GET /api/services/[id]
   ```

4. **Test validation** (should return 400 error):
   ```bash
   PUT /api/services/[id]
   {
     "debug_config": {
       "enabled": true,
       "tools": [
         { "toolset": "busybox", "mountPath": "/same" },
         { "toolset": "netshoot", "mountPath": "/same" }
       ]
     }
   }
   ```

## Conclusion

Task 6 has been successfully completed. The backend API now fully supports the new multi-debug-tools configuration format while maintaining complete backward compatibility with the legacy single-tool format. All validation and normalization logic is in place, and comprehensive tests have been created to verify the implementation.
