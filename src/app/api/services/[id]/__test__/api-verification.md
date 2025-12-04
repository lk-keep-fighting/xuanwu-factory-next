# API Verification for debug_config Support

## Summary

The backend API has been updated to support the new multi-debug-tools configuration format while maintaining backward compatibility with the legacy single-tool format.

## Changes Made

### 1. Import Statements
Added imports for validation and normalization functions:
```typescript
import { normalizeDebugConfig, validateDebugConfig } from '@/lib/debug-tools-utils'
```

### 2. GET Handler Enhancement
The GET endpoint now normalizes legacy debug_config to the new format automatically:

```typescript
// Normalize debug_config for backward compatibility
if (service.debug_config) {
  const normalizedDebugConfig = normalizeDebugConfig(service.debug_config)
  service.debug_config = normalizedDebugConfig as Prisma.JsonValue
}
```

**Behavior:**
- If the service has a legacy debug_config, it's automatically converted to multi-tool format
- If the service has a multi-tool debug_config, it's returned as-is
- If the service has no debug_config, null is returned

### 3. PUT Handler Enhancement
The PUT endpoint now validates and normalizes debug_config before saving:

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

**Behavior:**
- Accepts both legacy and multi-tool formats
- Automatically converts legacy format to multi-tool format
- Validates the configuration before saving
- Returns detailed error messages if validation fails
- Saves the normalized configuration to the database

## Validation Rules

The API validates the following:

1. **Mount Path Format**: Must start with `/` and contain only valid characters
2. **Path Uniqueness**: No two tools can have the same mount path
3. **Custom Image Required**: Custom toolset must have a valid image address
4. **Image Format**: Docker image addresses must follow naming conventions
5. **At Least One Tool**: Enabled configurations must have at least one tool

## Error Responses

### Validation Failure
```json
{
  "error": "调试工具配置验证失败",
  "details": [
    "挂载路径不能重复",
    "自定义镜像必须指定镜像地址"
  ]
}
```
Status: 400

### Service Not Found
```json
{
  "error": "服务不存在"
}
```
Status: 404

## Example Requests

### 1. Save New Multi-Tool Configuration
```bash
PUT /api/services/[id]
Content-Type: application/json

{
  "debug_config": {
    "enabled": true,
    "tools": [
      {
        "toolset": "busybox",
        "mountPath": "/debug-tools/busybox"
      },
      {
        "toolset": "netshoot",
        "mountPath": "/debug-tools/netshoot"
      }
    ]
  }
}
```

### 2. Save Legacy Configuration (Auto-Converted)
```bash
PUT /api/services/[id]
Content-Type: application/json

{
  "debug_config": {
    "enabled": true,
    "toolset": "busybox",
    "mountPath": "/debug-tools/busybox"
  }
}
```

This will be automatically converted to:
```json
{
  "enabled": true,
  "tools": [
    {
      "toolset": "busybox",
      "mountPath": "/debug-tools/busybox"
    }
  ]
}
```

### 3. Disable Debug Tools
```bash
PUT /api/services/[id]
Content-Type: application/json

{
  "debug_config": null
}
```

### 4. Get Service with Legacy Config
```bash
GET /api/services/[id]
```

Response (legacy config auto-converted):
```json
{
  "id": "...",
  "name": "my-service",
  "debug_config": {
    "enabled": true,
    "tools": [
      {
        "toolset": "busybox",
        "mountPath": "/debug-tools/busybox"
      }
    ]
  }
}
```

## Backward Compatibility

The API maintains full backward compatibility:

1. **Reading**: Legacy configs are automatically converted to multi-tool format when read
2. **Writing**: Both legacy and multi-tool formats are accepted and normalized
3. **Storage**: All configs are stored in the new multi-tool format
4. **No Migration Required**: Existing services continue to work without database migration

## Requirements Validated

✅ **Requirement 1.3**: System SHALL store all selected debug tools configuration to database
✅ **Requirement 5.1**: System SHALL convert old single-tool config to new multi-tool format
✅ **Requirement 5.2**: System SHALL preserve original tool type and mount path settings
✅ **Requirement 5.3**: System SHALL use new data structure to store multiple debug tools

## Testing

Unit tests have been created in `route.test.ts` to verify:
- Legacy config normalization
- Multi-tool config validation
- Error handling for invalid configurations
- Null/undefined handling
- Duplicate path detection
- Custom image validation

All validation logic is tested in `src/lib/__test__/debug-tools-utils.test.ts`.
