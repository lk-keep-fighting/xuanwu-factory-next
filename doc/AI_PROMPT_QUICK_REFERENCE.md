# AI Diagnostic Prompt Engineering - Quick Reference

## Quick Start

### Import the Prompts Module

```javascript
// CommonJS (WebSocket server)
const prompts = require('./websocket-prompts')

// TypeScript (Next.js app)
import * as prompts from '@/lib/ai-diagnostic/prompts'
```

## Core Functions

### 1. Detect User Intent

```javascript
const intent = prompts.detectUserIntent(userMessage)
// Returns: 'greeting' | 'capabilities' | 'diagnostic'
```

**Examples**:
- "你好" → `greeting`
- "你能做什么" → `capabilities`
- "服务启动失败" → `diagnostic`

### 2. Enhance User Message

```javascript
const { message, detectedScenario } = prompts.enhanceUserMessage(userMessage)
// Returns: { message: string, detectedScenario?: string }
```

**Detected Scenarios**:
- `podStartupFailure` - Pod startup issues
- `applicationError` - Application errors
- `performanceIssue` - Performance/resource issues
- `networkIssue` - Network connectivity issues

### 3. Build Enhanced System Prompt

```javascript
const systemPrompt = prompts.buildEnhancedSystemPrompt(
  serviceContext,  // Optional
  scenario         // Optional
)
```

**Service Context**:
```javascript
{
  serviceName: 'my-service',
  namespace: 'default',
  serviceId: '123',
  podNames: ['pod-1', 'pod-2']  // Optional
}
```

## Tool Descriptions

Access optimized tool descriptions:

```javascript
const toolDesc = prompts.TOOL_DESCRIPTIONS.getPodStatus
// Returns: { name, description }
```

**Available Tools**:
- `getPodStatus` - Pod status and events
- `getServiceLogs` - Application logs
- `getResourceMetrics` - CPU/memory usage
- `getDeploymentConfig` - Deployment configuration

## Quick Response Templates

```javascript
const greeting = prompts.QUICK_RESPONSE_TEMPLATES.greeting
const capabilities = prompts.QUICK_RESPONSE_TEMPLATES.capabilities
```

## Complete Usage Example

```javascript
const prompts = require('./websocket-prompts')

// 1. Detect intent
const intent = prompts.detectUserIntent(userMessage)

if (intent === 'greeting') {
  return prompts.QUICK_RESPONSE_TEMPLATES.greeting
}

if (intent === 'capabilities') {
  return prompts.QUICK_RESPONSE_TEMPLATES.capabilities
}

// 2. Enhance message and detect scenario
const { message, detectedScenario } = prompts.enhanceUserMessage(userMessage)

// 3. Build context-aware system prompt
const serviceContext = {
  serviceName: service.name,
  namespace: service.namespace,
  serviceId: service.id,
  podNames: await getPodNames(service.id),
}

const systemPrompt = prompts.buildEnhancedSystemPrompt(
  serviceContext,
  detectedScenario
)

// 4. Build messages for LLM
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory,
  { role: 'user', content: message },
]

// 5. Call LLM with enhanced prompts
const result = await streamText({
  model: yourModel,
  messages,
  tools: yourTools,
})
```

## Scenario Keywords

### Pod Startup Failure
- 启动失败, 无法启动
- CrashLoopBackOff, ImagePullBackOff
- Pending

### Application Error
- 报错, 异常, 错误
- exception, error

### Performance Issue
- 慢, 卡, 性能
- OOM, 内存, CPU

### Network Issue
- 连接, 网络, 超时
- timeout, connection

## System Prompt Structure

```
1. Role Definition
   - Kubernetes diagnostic expert
   - Core capabilities

2. Tool Usage Guidance
   - getPodStatus: When and how to use
   - getServiceLogs: When and how to use
   - getResourceMetrics: When and how to use
   - getDeploymentConfig: When and how to use

3. Diagnostic Workflow
   - Quick assessment
   - Deep analysis
   - Configuration verification
   - Comprehensive diagnosis

4. Output Requirements
   - Clear structure
   - Logical flow
   - Friendly language
   - Actionable recommendations

5. Best Practices
   - Tool call ordering
   - Data interpretation
   - Boundary awareness
   - Security considerations

6. Service Context (if provided)
   - Service name, namespace, ID
   - Pod list with log instructions

7. Scenario Context (if detected)
   - Scenario-specific guidance
```

## Testing

```bash
# Run automated tests
node test-prompt-scenarios.js

# Expected output:
# ✅ User Intent Detection: 6/6 passed
# ✅ Scenario Detection: 8/8 passed
# ✅ Enhanced Prompt Generation: Working
# ✅ Tool Descriptions: All validated
# ✅ Quick Response Templates: All validated
# ✅ Prompt Quality Metrics: All passed
```

## Common Patterns

### Pattern 1: Simple Greeting

```javascript
const intent = prompts.detectUserIntent('你好')
if (intent === 'greeting') {
  return prompts.QUICK_RESPONSE_TEMPLATES.greeting
}
```

### Pattern 2: Diagnostic with Scenario

```javascript
const { message, detectedScenario } = prompts.enhanceUserMessage(
  '服务启动失败了'
)
// detectedScenario: 'podStartupFailure'

const systemPrompt = prompts.buildEnhancedSystemPrompt(
  serviceContext,
  detectedScenario
)
// Includes scenario-specific guidance
```

### Pattern 3: Context-Aware Diagnosis

```javascript
const serviceContext = {
  serviceName: 'my-service',
  namespace: 'production',
  serviceId: '123',
  podNames: ['my-service-abc-xyz', 'my-service-def-uvw'],
}

const systemPrompt = prompts.buildEnhancedSystemPrompt(serviceContext)
// Includes service info and Pod list with log instructions
```

## Tips

### For Better Responses

1. **Always provide service context** when available
2. **Include Pod names** for accurate log retrieval
3. **Let scenario detection work** - it adds relevant guidance
4. **Use quick responses** for greetings and capability questions

### For Tool Descriptions

1. **Use optimized descriptions** from `TOOL_DESCRIPTIONS`
2. **Include usage scenarios** in tool definitions
3. **Emphasize important notes** (e.g., podName requirement)

### For Debugging

1. **Check detected scenario**: Log `detectedScenario` value
2. **Verify system prompt**: Log generated prompt length
3. **Test intent detection**: Use test script
4. **Validate tool descriptions**: Ensure they're being used

## Metrics

- Base system prompt: ~1,463 characters
- Enhanced prompt: ~1,800+ characters
- Tool descriptions: 250-380 characters each
- Scenario prompts: 150-200 characters each

## Resources

- Full Documentation: `doc/AI_PROMPT_ENGINEERING.md`
- Testing Guide: `doc/AI_DIAGNOSTIC_SCENARIOS_TESTING.md`
- Implementation: `src/lib/ai-diagnostic/prompts.ts`
- CommonJS Version: `websocket-prompts.js`
- Test Script: `test-prompt-scenarios.js`
