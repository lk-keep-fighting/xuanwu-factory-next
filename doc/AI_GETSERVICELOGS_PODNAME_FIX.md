# getServiceLogs podName Parameter Fix

## Issue Description

**Problem**: AI Diagnostic Assistant was unable to return logs when calling `getServiceLogs` with `podName` parameter.

**Symptoms**:
- AI would call the tool with parameters like `{"podName": "jdk17-797844bb79-55xn8", "lines": 200}`
- The tool call would appear in the UI but no logs would be returned
- Users would see the JSON parameters but not the actual log content

## Root Cause

There was a **mismatch between the prompt and the tool implementation**:

1. **Prompt** (`src/lib/ai-diagnostic/prompts.ts`):
   - Told the AI to use `podName` parameter
   - Example: `{"podName": "my-service-abc123-xyz", "lines": 200}`
   - Emphasized: "如果系统提示中提供了 Pod 列表，**必须**使用 podName 参数"

2. **Tool Implementation** (`src/lib/ai-diagnostic/tools/get-service-logs.ts`):
   - Only accepted `serviceId` as a required parameter
   - Did NOT accept `podName` parameter
   - Would fail validation when AI called it with `podName`

## Solution

Updated `getServiceLogs` tool to accept **both** `serviceId` and `podName` parameters:

### Changes Made

1. **Parameter Validation** (lines ~90-110):
   - Now accepts both `serviceId` and `podName`
   - At least one must be provided
   - Validates both parameters if present

2. **Pod Resolution Logic** (lines ~112-170):
   - If `podName` is provided: use it directly
   - If only `serviceId` is provided: look up service and find pods
   - Supports both workflows

3. **Tool Definition** (lines ~280-300):
   - Added `podName` to parameters schema
   - Updated description to mention both options
   - Changed `required` from `['serviceId']` to `[]` (at least one needed)



### Code Changes

**Before**:
```typescript
const { serviceId, lines, since } = params as GetServiceLogsParams

if (!serviceId || typeof serviceId !== 'string') {
  return {
    success: false,
    error: 'Missing required parameter: serviceId'
  }
}
```

**After**:
```typescript
const { serviceId, podName, lines, since } = params as GetServiceLogsParams & { podName?: string }

// Either serviceId or podName must be provided
if (!serviceId && !podName) {
  return {
    success: false,
    error: 'Missing required parameter: either serviceId or podName must be provided'
  }
}
```

## Testing

### Manual Test

You can test the fix by:

1. Open AI Diagnostic Assistant
2. Ask: "查看最新的日志" or "检查应用日志"
3. AI should call `getServiceLogs` with `podName` parameter
4. Logs should now be returned successfully

### Expected Behavior

**AI Tool Call**:
```json
{
  "name": "getServiceLogs",
  "arguments": {
    "podName": "jdk17-797844bb79-55xn8",
    "lines": 200
  }
}
```

**Tool Response**:
```json
{
  "success": true,
  "data": {
    "logs": "2024-12-05 17:30:00 INFO  Application started\n...",
    "truncated": false,
    "totalLines": 150
  }
}
```

## Benefits

1. **Flexibility**: Tool now supports both workflows
   - Direct pod access: `{"podName": "pod-123"}`
   - Service-based lookup: `{"serviceId": "service-id"}`

2. **AI Compatibility**: Matches what the prompt tells the AI to do

3. **Backward Compatible**: Existing calls with `serviceId` still work

4. **Better UX**: Users can now see logs when AI calls the tool

## Related Files

- `src/lib/ai-diagnostic/tools/get-service-logs.ts` - Tool implementation
- `src/lib/ai-diagnostic/prompts.ts` - Prompt definitions
- `doc/AI_DIAGNOSTIC_USER_GUIDE.md` - User documentation
- `test-podname-fix.js` - Test script

## Verification

To verify the fix is working:

```bash
# Check that the tool accepts podName
grep -A 5 "podName" src/lib/ai-diagnostic/tools/get-service-logs.ts

# Test the tool (if you have a running cluster)
node test-podname-fix.js
```

## Impact

- **User Impact**: HIGH - Fixes a critical bug preventing log retrieval
- **Breaking Changes**: NONE - Backward compatible
- **Performance**: No impact
- **Security**: No impact

## Next Steps

1. ✅ Update tool implementation
2. ✅ Update tool definition
3. ✅ Create test script
4. ✅ Document the fix
5. ⏳ Deploy to production
6. ⏳ Monitor for issues
7. ⏳ Update user documentation if needed

## Notes

- The prompt was correct in telling AI to use `podName`
- The tool implementation was missing this parameter
- This is a common issue when prompt and code get out of sync
- Consider adding integration tests to catch these mismatches

---

**Fixed**: 2024-12-05  
**Severity**: High  
**Type**: Bug Fix  
**Component**: AI Diagnostic Tools
