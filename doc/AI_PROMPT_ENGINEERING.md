# AI Diagnostic Prompt Engineering

## Overview

This document describes the optimized prompt engineering implementation for the AI Diagnostic Assistant. The improvements focus on providing clear guidance to the LLM, enhancing tool usage, and improving diagnostic quality.

## Key Improvements

### 1. Enhanced System Prompt

The system prompt has been significantly improved with:

- **Clear Role Definition**: Establishes the AI as a professional Kubernetes diagnostic expert
- **Core Capabilities**: Explicitly lists problem understanding, data collection, root cause analysis, and solution provision
- **Tool Usage Guidance**: Detailed descriptions of when and how to use each diagnostic tool
- **Diagnostic Workflow**: Step-by-step process for systematic problem diagnosis
- **Output Requirements**: Specifications for response structure, logic, language, and actionability
- **Best Practices**: Guidelines for tool call ordering, data interpretation, boundary awareness, and security

### 2. Detailed Tool Descriptions

Each diagnostic tool now includes:

- **Purpose**: What the tool does
- **Return Information**: What data it provides
- **Applicable Scenarios**: When to use the tool
- **Important Notes**: Critical usage information (e.g., podName requirement for logs)
- **Usage Recommendations**: Best practices for effective tool usage

#### Tool Descriptions

**getPodStatus**
- Retrieves Pod running status, restart counts, and related events
- Best for: Pod startup failures, container state issues, Kubernetes-level problems
- Recommended as the first diagnostic step

**getServiceLogs**
- Retrieves application logs from containers
- Best for: Application errors, business logic issues, error stack traces
- **Critical**: Must specify podName parameter when Pod list is provided
- Supports configurable line count (default 100, max 1000)

**getResourceMetrics**
- Retrieves CPU and memory usage statistics
- Best for: Resource shortage issues, OOMKilled events, performance problems
- Should be compared with configured resource limits

**getDeploymentConfig**
- Retrieves deployment configuration (image, replicas, resources, env vars, volumes)
- Best for: Configuration verification, image version checks, environment variable validation

### 3. Scenario Detection

Automatic detection of diagnostic scenarios based on user message keywords:

- **Pod Startup Failure**: Keywords like "启动失败", "CrashLoopBackOff", "ImagePullBackOff"
- **Application Error**: Keywords like "报错", "异常", "exception", "error"
- **Performance Issue**: Keywords like "慢", "性能", "OOM", "CPU", "内存"
- **Network Issue**: Keywords like "连接", "网络", "超时", "timeout"

When a scenario is detected, additional context-specific guidance is added to the system prompt.

### 4. Intent Detection

Recognizes user intent to provide appropriate responses:

- **Greeting**: Simple greetings like "你好", "hello", "hi"
- **Capabilities**: Questions about what the AI can do
- **Diagnostic**: Actual problem descriptions (default)

### 5. Context-Aware Prompts

The system prompt is dynamically enhanced with:

- **Service Information**: Name, namespace, service ID
- **Pod List**: Available Pods with explicit instructions for log retrieval
- **Scenario Context**: Specific guidance based on detected problem type
- **Conversation History**: Previous messages for context continuity

### 6. Quick Response Templates

Pre-defined templates for common queries:

- **Greeting Response**: Friendly introduction with capability overview
- **Capabilities Response**: Detailed list of diagnostic abilities

## Implementation

### File Structure

```
src/lib/ai-diagnostic/prompts.ts    # TypeScript implementation
websocket-prompts.js                 # CommonJS version for WebSocket server
websocket-ai-agent.js                # Updated to use optimized prompts
```

### Usage Example

```javascript
const prompts = require('./websocket-prompts')

// Detect user intent
const intent = prompts.detectUserIntent(userMessage)

// Enhance user message and detect scenario
const { message, detectedScenario } = prompts.enhanceUserMessage(userMessage)

// Build enhanced system prompt
const serviceContext = {
  serviceName: 'my-service',
  namespace: 'default',
  serviceId: '123',
  podNames: ['my-service-abc-xyz'],
}

const systemPrompt = prompts.buildEnhancedSystemPrompt(
  serviceContext,
  detectedScenario
)

// Use in LLM call
const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: message },
]
```

## Testing

Run the prompt scenario tests:

```bash
node test-prompt-scenarios.js
```

This validates:
- User intent detection
- Scenario detection
- Enhanced prompt generation
- Tool descriptions
- Quick response templates
- Prompt quality metrics

## Benefits

### For Users

1. **Better Understanding**: AI provides more structured and logical responses
2. **Faster Diagnosis**: Systematic workflow leads to quicker problem identification
3. **Clearer Guidance**: Actionable recommendations instead of vague suggestions
4. **Context Awareness**: AI adapts to specific problem scenarios

### For the AI

1. **Clear Instructions**: Knows exactly what to do and when
2. **Tool Guidance**: Understands when and how to use each tool
3. **Workflow Structure**: Follows a systematic diagnostic process
4. **Output Standards**: Produces consistent, well-formatted responses

### For Developers

1. **Maintainable**: Prompts are centralized and well-documented
2. **Extensible**: Easy to add new scenarios or tools
3. **Testable**: Comprehensive test coverage for prompt logic
4. **Reusable**: Prompt components can be mixed and matched

## Best Practices

### When Adding New Tools

1. Create a detailed description following the existing format
2. Include purpose, return information, scenarios, and recommendations
3. Add the tool to `TOOL_DESCRIPTIONS` in prompts module
4. Update the system prompt if the tool represents a new capability

### When Adding New Scenarios

1. Define scenario-specific guidance in `SCENARIO_PROMPTS`
2. Add detection keywords to `enhanceUserMessage` function
3. Test with representative user messages
4. Document the scenario in this file

### When Modifying System Prompt

1. Maintain the existing structure (sections with clear headings)
2. Keep language professional but accessible
3. Provide concrete examples where helpful
4. Test with various user queries to ensure effectiveness

## Metrics

### Prompt Quality Indicators

- **Completeness**: All necessary information is provided
- **Clarity**: Instructions are unambiguous
- **Structure**: Well-organized with clear sections
- **Actionability**: Provides specific guidance, not vague suggestions
- **Context-Awareness**: Adapts to service and scenario context

### Current Metrics

- Base system prompt: ~1,463 characters
- Enhanced prompt (with context): ~1,800+ characters
- Tool descriptions: 250-380 characters each
- Scenario prompts: 150-200 characters each

## Future Enhancements

1. **Multi-Language Support**: Add English prompts for international users
2. **Learning from Feedback**: Incorporate user feedback to improve prompts
3. **Advanced Scenarios**: Add more specific scenarios (e.g., database issues, cache problems)
4. **Dynamic Examples**: Generate examples based on actual service configuration
5. **Prompt A/B Testing**: Test different prompt variations to optimize effectiveness

## References

- Design Document: `.kiro/specs/ai-diagnostic-assistant/design.md`
- Requirements: `.kiro/specs/ai-diagnostic-assistant/requirements.md`
- AI Agent Implementation: `websocket-ai-agent.js`
- Tool Implementations: `websocket-diagnostic-tools.js`
