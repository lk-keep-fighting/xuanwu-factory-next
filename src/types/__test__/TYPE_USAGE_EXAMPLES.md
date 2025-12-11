# AI Diagnostic Types - Usage Examples

This document provides examples of how to use the AI diagnostic type definitions in your code.

## Importing Types

### From the types module
```typescript
import type {
  Message,
  ToolCall,
  ClientMessage,
  ServerMessage,
  AIDiagnosticPanelProps,
} from '@/types/ai-diagnostic'
```

### From the ai-diagnostic module (recommended)
```typescript
import type {
  Message,
  ToolCall,
  ClientMessage,
  ServerMessage,
  AIDiagnosticPanelProps,
} from '@/lib/ai-diagnostic'
```

## React Component Examples

### AI Diagnostic Panel Component
```typescript
import type { AIDiagnosticPanelProps } from '@/lib/ai-diagnostic'

export function AIDiagnosticPanel({ 
  serviceId, 
  serviceName, 
  onClose 
}: AIDiagnosticPanelProps) {
  // Component implementation
}
```

### Message List Component
```typescript
import type { MessageListProps } from '@/lib/ai-diagnostic'

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

### Message Input Component
```typescript
import type { MessageInputProps } from '@/lib/ai-diagnostic'

export function MessageInput({ onSend, disabled, placeholder }: MessageInputProps) {
  const [input, setInput] = useState('')
  
  const handleSubmit = () => {
    if (input.trim()) {
      onSend(input)
      setInput('')
    }
  }
  
  return (
    <input
      value={input}
      onChange={(e) => setInput(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
}
```

## WebSocket Communication Examples

### Client-side WebSocket Handler
```typescript
import type { 
  ClientMessage, 
  ServerMessage,
  DiagnosticRequestMessage 
} from '@/lib/ai-diagnostic'

function sendDiagnosticRequest(ws: WebSocket, serviceId: string, message: string) {
  const request: DiagnosticRequestMessage = {
    type: 'diagnostic_request',
    payload: {
      serviceId,
      message,
    }
  }
  
  ws.send(JSON.stringify(request))
}

function handleServerMessage(data: string) {
  const message: ServerMessage = JSON.parse(data)
  
  switch (message.type) {
    case 'diagnostic_response':
      console.log('Response:', message.payload.content)
      break
    case 'tool_call':
      console.log('Tool call:', message.payload.toolName)
      break
    case 'error':
      console.error('Error:', message.payload.message)
      break
    case 'pong':
      console.log('Pong received')
      break
  }
}
```

### Server-side WebSocket Handler
```typescript
import type { 
  ClientMessage, 
  DiagnosticResponseMessage,
  ToolCallMessage,
  ErrorMessage 
} from '@/lib/ai-diagnostic'

function handleClientMessage(ws: WebSocket, data: string) {
  const message: ClientMessage = JSON.parse(data)
  
  if (message.type === 'diagnostic_request') {
    // Process diagnostic request
    const response: DiagnosticResponseMessage = {
      type: 'diagnostic_response',
      payload: {
        content: 'Analyzing your service...',
        done: false,
      }
    }
    ws.send(JSON.stringify(response))
  }
}

function sendToolCall(ws: WebSocket, toolName: string, toolCallId: string) {
  const message: ToolCallMessage = {
    type: 'tool_call',
    payload: {
      toolName,
      toolCallId,
      status: 'running',
    }
  }
  ws.send(JSON.stringify(message))
}

function sendError(ws: WebSocket, error: string) {
  const message: ErrorMessage = {
    type: 'error',
    payload: {
      message: error,
      code: 'INTERNAL_ERROR',
    }
  }
  ws.send(JSON.stringify(message))
}
```

## AI Agent Examples

### Creating a Diagnostic Request
```typescript
import type { DiagnosticRequest } from '@/lib/ai-diagnostic'

const request: DiagnosticRequest = {
  serviceId: 'my-service-123',
  message: 'Why is my service crashing?',
  context: {
    serviceName: 'My Service',
    namespace: 'production',
    previousMessages: [],
  }
}
```

### Processing Diagnostic Chunks
```typescript
import type { DiagnosticChunk } from '@/lib/ai-diagnostic'

async function processDiagnostic(chunks: AsyncGenerator<DiagnosticChunk>) {
  for await (const chunk of chunks) {
    switch (chunk.type) {
      case 'text':
        console.log('AI says:', chunk.content)
        break
      case 'tool_call':
        console.log('Calling tool:', chunk.toolCall?.name)
        break
      case 'tool_result':
        console.log('Tool result:', chunk.toolResult?.data)
        break
    }
  }
}
```

## Tool Implementation Examples

### Implementing a Custom Tool
```typescript
import type { Tool, ToolContext, ToolResult } from '@/lib/ai-diagnostic'

const myCustomTool: Tool = {
  name: 'getCustomMetrics',
  description: 'Get custom metrics for a service',
  parameters: {
    type: 'object',
    properties: {
      serviceId: {
        type: 'string',
        description: 'The service ID',
      },
      metricName: {
        type: 'string',
        description: 'The metric name to query',
      },
    },
    required: ['serviceId', 'metricName'],
  },
  execute: async (params: unknown, context: ToolContext): Promise<ToolResult> => {
    try {
      // Validate params
      const { serviceId, metricName } = params as { 
        serviceId: string
        metricName: string 
      }
      
      // Fetch metrics
      const data = await fetchMetrics(serviceId, metricName)
      
      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
}
```

### Using Tool Parameters and Results
```typescript
import type { 
  GetPodStatusParams, 
  PodStatusResult,
  GetServiceLogsParams,
  ServiceLogsResult 
} from '@/lib/ai-diagnostic'

// Get pod status
const podParams: GetPodStatusParams = {
  serviceId: 'my-service-123',
}

const podResult: PodStatusResult = {
  pods: [
    {
      name: 'my-service-pod-1',
      status: 'Running',
      restartCount: 0,
      age: '2h',
      events: [],
    },
  ],
}

// Get service logs
const logParams: GetServiceLogsParams = {
  serviceId: 'my-service-123',
  lines: 100,
  since: '1h',
}

const logResult: ServiceLogsResult = {
  logs: 'Log line 1\nLog line 2\n...',
  truncated: false,
  totalLines: 100,
}
```

## Message Management Examples

### Creating Messages
```typescript
import type { Message, ToolCall } from '@/lib/ai-diagnostic'

// User message
const userMessage: Message = {
  id: crypto.randomUUID(),
  role: 'user',
  content: 'Why is my service slow?',
  timestamp: Date.now(),
}

// Assistant message with tool calls
const assistantMessage: Message = {
  id: crypto.randomUUID(),
  role: 'assistant',
  content: 'Let me check the resource usage...',
  timestamp: Date.now(),
  toolCalls: [
    {
      id: crypto.randomUUID(),
      name: 'getResourceMetrics',
      status: 'running',
    },
  ],
}
```

### Updating Tool Call Status
```typescript
import type { Message, ToolCall } from '@/lib/ai-diagnostic'

function updateToolCallStatus(
  message: Message, 
  toolCallId: string, 
  status: 'success' | 'error',
  result?: unknown,
  error?: string
): Message {
  return {
    ...message,
    toolCalls: message.toolCalls?.map(tc => 
      tc.id === toolCallId 
        ? { ...tc, status, result, error }
        : tc
    ),
  }
}
```

## Error Handling Examples

### Creating Error Responses
```typescript
import type { ErrorResponse } from '@/lib/ai-diagnostic'

const connectionError: ErrorResponse = {
  code: 'CONNECTION_ERROR',
  message: 'Failed to connect to WebSocket server',
  retryable: true,
}

const authError: ErrorResponse = {
  code: 'AUTH_ERROR',
  message: 'Unauthorized access to service',
  details: { serviceId: 'my-service-123' },
  retryable: false,
}
```

## Type Guards

### Checking Message Types
```typescript
import type { ServerMessage } from '@/lib/ai-diagnostic'

function isDiagnosticResponse(msg: ServerMessage): msg is DiagnosticResponseMessage {
  return msg.type === 'diagnostic_response'
}

function isToolCall(msg: ServerMessage): msg is ToolCallMessage {
  return msg.type === 'tool_call'
}

function isError(msg: ServerMessage): msg is ErrorMessage {
  return msg.type === 'error'
}

// Usage
function handleMessage(msg: ServerMessage) {
  if (isDiagnosticResponse(msg)) {
    console.log(msg.payload.content)
  } else if (isToolCall(msg)) {
    console.log(msg.payload.toolName)
  } else if (isError(msg)) {
    console.error(msg.payload.message)
  }
}
```
