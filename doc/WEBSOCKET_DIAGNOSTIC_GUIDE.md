# WebSocket Diagnostic Connection Guide

## Overview

The WebSocket server now supports AI-powered diagnostic connections for Kubernetes services. This guide explains how to connect and interact with the diagnostic endpoint.

## Connection

### Endpoint

```
ws://localhost:3001/api/services/:serviceId/diagnostic
```

Replace `:serviceId` with the actual service ID from your database.

### Example Connection (JavaScript)

```javascript
const WebSocket = require('ws')

const serviceId = 'your-service-id'
const ws = new WebSocket(`ws://localhost:3001/api/services/${serviceId}/diagnostic`)

ws.on('open', () => {
  console.log('Connected to diagnostic service')
})

ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  console.log('Received:', message)
})
```

## Message Protocol

### Client → Server Messages

#### 1. Diagnostic Request

Send a diagnostic request to analyze service issues:

```json
{
  "type": "diagnostic_request",
  "payload": {
    "serviceId": "service-123",
    "message": "服务启动失败，请帮我诊断问题"
  }
}
```

**Fields:**
- `type`: Must be `"diagnostic_request"`
- `payload.serviceId`: The service ID to diagnose
- `payload.message`: User's question or problem description

#### 2. Ping (Heartbeat)

Send a ping to keep the connection alive:

```json
{
  "type": "ping"
}
```

### Server → Client Messages

#### 1. Diagnostic Response

Streaming response from the AI diagnostic agent:

```json
{
  "type": "diagnostic_response",
  "payload": {
    "content": "正在分析您的问题...",
    "done": false
  }
}
```

**Fields:**
- `type`: Always `"diagnostic_response"`
- `payload.content`: Text content (may be empty when done)
- `payload.done`: `true` when response is complete, `false` for streaming chunks

**Note:** You will receive multiple messages with `done: false` as the AI streams its response, followed by a final message with `done: true`.

#### 2. Error

Error message when something goes wrong:

```json
{
  "type": "error",
  "payload": {
    "message": "服务不存在",
    "code": "SERVICE_NOT_FOUND"
  }
}
```

**Common Error Codes:**
- `SERVICE_NOT_FOUND`: The specified service doesn't exist
- `INVALID_INPUT`: Empty or invalid message
- `MESSAGE_PROCESSING_ERROR`: Error processing the message
- `CONNECTION_ERROR`: Connection establishment failed
- `DIAGNOSTIC_ERROR`: Error during diagnostic execution

#### 3. Pong (Heartbeat Response)

Response to ping message:

```json
{
  "type": "pong"
}
```

## Connection Lifecycle

### 1. Connection Established

When you connect, the server will:
1. Generate a unique session ID
2. Fetch service information from the database
3. Send a welcome message

Example welcome message:
```json
{
  "type": "diagnostic_response",
  "payload": {
    "content": "已连接到服务 my-service，我可以帮助您诊断问题。请描述您遇到的问题。",
    "done": true
  }
}
```

### 2. Active Session

During an active session:
- Send diagnostic requests as needed
- Server sends ping every 30 seconds
- Respond to pings to keep connection alive
- Connection times out after 5 minutes of inactivity

### 3. Connection Closed

The connection will close when:
- Client explicitly closes the connection
- Connection timeout (5 minutes of inactivity)
- Server error occurs
- Server shutdown

## Example Usage

### Complete Example

```javascript
const WebSocket = require('ws')

const serviceId = 'my-service-id'
const ws = new WebSocket(`ws://localhost:3001/api/services/${serviceId}/diagnostic`)

let responseBuffer = ''

ws.on('open', () => {
  console.log('✓ Connected')
  
  // Send diagnostic request
  ws.send(JSON.stringify({
    type: 'diagnostic_request',
    payload: {
      serviceId: serviceId,
      message: 'Pod 一直重启，请帮我分析原因'
    }
  }))
})

ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  
  switch (message.type) {
    case 'diagnostic_response':
      if (message.payload.content) {
        responseBuffer += message.payload.content
        process.stdout.write(message.payload.content)
      }
      if (message.payload.done) {
        console.log('\n\n✓ Response complete')
        console.log('Full response:', responseBuffer)
      }
      break
      
    case 'error':
      console.error('✗ Error:', message.payload.message)
      console.error('  Code:', message.payload.code)
      ws.close()
      break
      
    case 'pong':
      console.log('♥ Heartbeat')
      break
  }
})

ws.on('close', (code, reason) => {
  console.log(`Connection closed (${code})`)
})

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message)
})

// Handle Ctrl+C
process.on('SIGINT', () => {
  ws.close()
  process.exit(0)
})
```

### React/Browser Example

```javascript
import { useEffect, useState } from 'react'

function DiagnosticPanel({ serviceId }) {
  const [ws, setWs] = useState(null)
  const [messages, setMessages] = useState([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const websocket = new WebSocket(
      `ws://localhost:3001/api/services/${serviceId}/diagnostic`
    )

    websocket.onopen = () => {
      console.log('Connected')
      setIsConnected(true)
    }

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      if (message.type === 'diagnostic_response') {
        if (message.payload.content) {
          setMessages(prev => [
            ...prev,
            { type: 'assistant', content: message.payload.content }
          ])
        }
      } else if (message.type === 'error') {
        console.error('Error:', message.payload.message)
      }
    }

    websocket.onclose = () => {
      console.log('Disconnected')
      setIsConnected(false)
    }

    setWs(websocket)

    return () => {
      websocket.close()
    }
  }, [serviceId])

  const sendMessage = (text) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'diagnostic_request',
        payload: {
          serviceId,
          message: text
        }
      }))
      
      setMessages(prev => [
        ...prev,
        { type: 'user', content: text }
      ])
    }
  }

  return (
    <div>
      <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      <div>
        {messages.map((msg, i) => (
          <div key={i} className={msg.type}>
            {msg.content}
          </div>
        ))}
      </div>
      <input
        type="text"
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value)
            e.target.value = ''
          }
        }}
      />
    </div>
  )
}
```

## Testing

### Manual Test Script

A test script is provided for manual testing:

```bash
# Start the WebSocket server
npm run ws:dev

# In another terminal, run the test
node test-websocket-diagnostic.js [serviceId]
```

The test script will:
1. Connect to the diagnostic endpoint
2. Send a diagnostic request
3. Display the streaming response
4. Test heartbeat (ping/pong)
5. Close the connection

### Expected Output

```
Testing WebSocket Diagnostic Connection
========================================
Service ID: test-service-id
URL: ws://localhost:3001/api/services/test-service-id/diagnostic

✓ WebSocket connection established

Sending diagnostic request...
已连接到服务 my-service，我可以帮助您诊断问题。请描述您遇到的问题。

正在分析您的问题...
[streaming response content...]

✓ Diagnostic response completed

Testing heartbeat...
✓ Heartbeat response received

Test completed successfully!
Closing connection...

WebSocket connection closed (code: 1000)
```

## Configuration

### Environment Variables

- `WS_PORT`: WebSocket server port (default: 3001)
- `HEARTBEAT_INTERVAL`: Heartbeat interval in milliseconds (default: 30000)
- `CONNECTION_TIMEOUT`: Connection timeout in milliseconds (default: 300000)

### Timeouts

- **Heartbeat**: 30 seconds
- **Connection Timeout**: 5 minutes of inactivity
- **Message Processing**: No explicit timeout (handled by AI Agent)

## Troubleshooting

### Connection Refused

**Problem:** Cannot connect to WebSocket server

**Solutions:**
1. Ensure WebSocket server is running: `npm run ws:dev`
2. Check the port is correct (default: 3001)
3. Verify no firewall blocking the connection

### Service Not Found Error

**Problem:** Receive `SERVICE_NOT_FOUND` error

**Solutions:**
1. Verify the service ID exists in the database
2. Check the service hasn't been deleted
3. Ensure database connection is working

### No Response from AI

**Problem:** Connection works but no diagnostic response

**Solutions:**
1. Check AI Agent Service is properly compiled
2. Verify AI configuration (Ollama or OpenAI)
3. Check server logs for errors
4. Ensure Next.js build is up to date: `npm run build`

### Connection Timeout

**Problem:** Connection closes after 5 minutes

**Solutions:**
1. Send periodic messages to keep connection alive
2. Implement ping/pong heartbeat in your client
3. Adjust `CONNECTION_TIMEOUT` if needed

## Security Considerations

### Authentication

Currently, the WebSocket server does not implement authentication. In production:

1. Add JWT token validation
2. Verify user has access to the specified service
3. Implement rate limiting
4. Add request logging for audit

### Input Validation

The server validates:
- Message is not empty
- Service exists in database
- Message format is valid JSON

### Error Handling

All errors are caught and returned as structured error messages. Sensitive information is not exposed in error messages.

## Next Steps

1. **Frontend Integration**: Implement React components to use this WebSocket connection
2. **Authentication**: Add user authentication and authorization
3. **Session Persistence**: Store diagnostic sessions in database
4. **Tool Integration**: Connect AI Agent to actual diagnostic tools
5. **Monitoring**: Add metrics and logging for production use

## Related Documentation

- [Task 8 Summary](./TASK_8_WEBSOCKET_DIAGNOSTIC_SUMMARY.md)
- [AI Diagnostic Design](../.kiro/specs/ai-diagnostic-assistant/design.md)
- [Requirements](../.kiro/specs/ai-diagnostic-assistant/requirements.md)
