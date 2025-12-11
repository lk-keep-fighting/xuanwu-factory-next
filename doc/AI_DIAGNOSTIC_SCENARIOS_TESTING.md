# AI Diagnostic Scenarios Testing Guide

## Overview

This guide provides test scenarios to validate the AI Diagnostic Assistant's response quality across different problem types. Use these scenarios to ensure the prompt engineering improvements are working effectively.

## Test Scenarios

### Scenario 1: Pod Startup Failure

**User Message**: "我的服务启动失败了，Pod 一直在 CrashLoopBackOff 状态"

**Expected AI Behavior**:
1. Detect scenario: `podStartupFailure`
2. Call `getPodStatus` first to check Pod state and events
3. Analyze events for error messages
4. If needed, call `getServiceLogs` to check application logs
5. Provide structured diagnosis with:
   - Observed symptoms
   - Root cause analysis
   - Specific fix recommendations

**Quality Indicators**:
- ✅ Calls getPodStatus as first step
- ✅ Interprets Pod events correctly
- ✅ Identifies common causes (image pull errors, config issues, etc.)
- ✅ Provides actionable fix steps

---

### Scenario 2: Application Error

**User Message**: "应用日志里一直报错，但是 Pod 状态是 Running"

**Expected AI Behavior**:
1. Detect scenario: `applicationError`
2. Call `getPodStatus` to confirm Pod is running
3. Call `getServiceLogs` with appropriate podName to retrieve logs
4. Analyze log content for error patterns
5. Provide diagnosis with:
   - Error identification
   - Possible causes
   - Recommended fixes

**Quality Indicators**:
- ✅ Uses podName parameter when calling getServiceLogs
- ✅ Identifies error types from logs
- ✅ Distinguishes between application vs infrastructure issues
- ✅ Suggests relevant troubleshooting steps

---

### Scenario 3: Performance Issue

**User Message**: "服务响应很慢，怀疑是资源不足"

**Expected AI Behavior**:
1. Detect scenario: `performanceIssue`
2. Call `getResourceMetrics` to check CPU/memory usage
3. Call `getDeploymentConfig` to check resource limits
4. Compare usage vs limits
5. Provide analysis with:
   - Current resource utilization
   - Comparison with configured limits
   - Recommendations for resource adjustment

**Quality Indicators**:
- ✅ Checks both metrics and configuration
- ✅ Calculates usage percentages
- ✅ Identifies resource bottlenecks
- ✅ Provides specific resource adjustment recommendations

---

### Scenario 4: Network Connectivity

**User Message**: "服务无法连接到数据库，一直超时"

**Expected AI Behavior**:
1. Detect scenario: `networkIssue`
2. Call `getPodStatus` to check for network-related events
3. Call `getServiceLogs` to find connection error messages
4. Call `getDeploymentConfig` to verify network configuration
5. Provide diagnosis with:
   - Network error identification
   - Configuration verification
   - Connectivity troubleshooting steps

**Quality Indicators**:
- ✅ Checks multiple aspects (events, logs, config)
- ✅ Identifies network-specific errors
- ✅ Suggests connectivity tests
- ✅ Recommends configuration checks

---

### Scenario 5: Configuration Issue

**User Message**: "服务启动后立即退出，没有明显错误"

**Expected AI Behavior**:
1. Call `getPodStatus` to check exit codes and events
2. Call `getDeploymentConfig` to review configuration
3. Call `getServiceLogs` to check startup logs
4. Provide diagnosis with:
   - Exit code interpretation
   - Configuration validation
   - Common misconfigurations

**Quality Indicators**:
- ✅ Systematic approach (status → config → logs)
- ✅ Interprets exit codes correctly
- ✅ Identifies configuration problems
- ✅ Suggests configuration fixes

---

### Scenario 6: Greeting / Capabilities

**User Message**: "你好，你能帮我做什么？"

**Expected AI Behavior**:
1. Detect intent: `greeting` or `capabilities`
2. Provide quick response without tool calls
3. List available capabilities
4. Invite user to describe their problem

**Quality Indicators**:
- ✅ Responds without unnecessary tool calls
- ✅ Provides clear capability overview
- ✅ Friendly and professional tone
- ✅ Encourages user to proceed with diagnosis

---

## Testing Checklist

### Prompt Quality

- [ ] System prompt includes role definition
- [ ] Tool descriptions are detailed and clear
- [ ] Diagnostic workflow is explained
- [ ] Output requirements are specified
- [ ] Best practices are included
- [ ] Security considerations are mentioned

### Scenario Detection

- [ ] Pod startup failures are detected
- [ ] Application errors are detected
- [ ] Performance issues are detected
- [ ] Network issues are detected
- [ ] Greetings are detected
- [ ] Capability questions are detected

### Tool Usage

- [ ] getPodStatus is called appropriately
- [ ] getServiceLogs uses podName parameter correctly
- [ ] getResourceMetrics is called for performance issues
- [ ] getDeploymentConfig is called for configuration checks
- [ ] Tools are called in logical order
- [ ] Redundant tool calls are avoided

### Response Quality

- [ ] Responses are structured with clear sections
- [ ] Analysis follows logical flow (observation → analysis → recommendation)
- [ ] Language is professional but accessible
- [ ] Recommendations are specific and actionable
- [ ] Sensitive information is not exposed
- [ ] Markdown formatting is used effectively

### Context Awareness

- [ ] Service information is included in prompt
- [ ] Pod names are provided when available
- [ ] Scenario-specific guidance is added
- [ ] Conversation history is maintained
- [ ] Previous context is referenced appropriately

## Manual Testing Procedure

### Setup

1. Ensure AI Diagnostic Assistant is running
2. Open a service detail page
3. Click "AI 诊断" button to open diagnostic panel

### Test Each Scenario

For each scenario above:

1. **Input**: Enter the user message
2. **Observe**: Watch the AI's tool calls and responses
3. **Validate**: Check against expected behavior and quality indicators
4. **Record**: Note any issues or unexpected behavior

### Evaluation Criteria

Rate each aspect on a scale of 1-5:

- **Tool Selection** (1-5): Did the AI choose the right tools?
- **Tool Order** (1-5): Were tools called in a logical sequence?
- **Analysis Quality** (1-5): Was the analysis thorough and accurate?
- **Response Clarity** (1-5): Was the response clear and well-structured?
- **Actionability** (1-5): Were recommendations specific and actionable?

**Overall Score**: Average of all criteria (aim for 4.0+)

## Automated Testing

Run the prompt scenario tests:

```bash
node test-prompt-scenarios.js
```

This validates:
- Intent detection accuracy
- Scenario detection accuracy
- Prompt generation correctness
- Tool description completeness

## Common Issues and Solutions

### Issue: AI doesn't use podName parameter

**Symptom**: getServiceLogs is called without podName even when Pod list is provided

**Solution**: 
- Verify Pod names are included in service context
- Check system prompt includes explicit podName instruction
- Ensure tool description emphasizes podName requirement

### Issue: AI calls tools in wrong order

**Symptom**: Calls getServiceLogs before getPodStatus

**Solution**:
- Review diagnostic workflow in system prompt
- Emphasize getPodStatus as first step
- Add scenario-specific tool ordering guidance

### Issue: AI provides vague recommendations

**Symptom**: Responses lack specific action steps

**Solution**:
- Strengthen output requirements in system prompt
- Add examples of good vs bad recommendations
- Emphasize actionability in prompt

### Issue: AI doesn't detect scenario correctly

**Symptom**: Wrong scenario detected or no scenario detected

**Solution**:
- Review keyword list in `enhanceUserMessage`
- Add more keywords for the scenario
- Test with various phrasings of the same problem

## Performance Benchmarks

### Response Time

- **Greeting/Capabilities**: < 2 seconds (no tool calls)
- **Simple Diagnosis**: < 10 seconds (1-2 tool calls)
- **Complex Diagnosis**: < 20 seconds (3-4 tool calls)

### Token Usage

- **Base System Prompt**: ~1,500 tokens
- **Enhanced Prompt**: ~2,000 tokens
- **Average Response**: ~500-1,000 tokens
- **Total per Request**: ~3,000-4,000 tokens

### Accuracy Targets

- **Intent Detection**: > 95% accuracy
- **Scenario Detection**: > 90% accuracy
- **Tool Selection**: > 85% correct first tool
- **Problem Identification**: > 80% correct diagnosis

## Continuous Improvement

### Feedback Collection

1. Track user satisfaction ratings
2. Collect examples of good and bad responses
3. Identify common failure patterns
4. Gather user suggestions

### Prompt Iteration

1. Analyze feedback and failure patterns
2. Identify prompt weaknesses
3. Test prompt modifications
4. Deploy improvements incrementally
5. Measure impact on quality metrics

### Documentation Updates

1. Document new scenarios as they emerge
2. Update testing procedures based on findings
3. Share best practices with team
4. Maintain changelog of prompt improvements

## Resources

- Prompt Engineering Documentation: `doc/AI_PROMPT_ENGINEERING.md`
- Design Document: `.kiro/specs/ai-diagnostic-assistant/design.md`
- Requirements: `.kiro/specs/ai-diagnostic-assistant/requirements.md`
- Test Script: `test-prompt-scenarios.js`
