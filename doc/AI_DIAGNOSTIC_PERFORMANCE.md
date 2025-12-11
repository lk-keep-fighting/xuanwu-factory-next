# AI 诊断助手性能优化文档

本文档描述了 AI 诊断助手的性能优化措施，确保系统在高负载下稳定运行。

## 优化概览

根据需求 3.2 和 3.5，我们实现了以下性能优化：

1. **日志读取超时机制** - 防止日志读取操作阻塞
2. **WebSocket 心跳检测增强** - 及时发现和清理死连接
3. **并发连接数限制** - 防止资源耗尽
4. **流式响应性能优化** - 减少网络开销，提高响应速度

## 1. 日志读取超时机制

### 问题
日志读取操作可能因为以下原因导致长时间阻塞：
- Pod 日志量过大
- Kubernetes API 响应慢
- 网络延迟

### 解决方案
实现了基于 Promise.race 的超时保护机制：

```javascript
const LOG_READ_TIMEOUT = parseInt(process.env.LOG_READ_TIMEOUT || '30000', 10) // 30秒

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('日志读取超时')), LOG_READ_TIMEOUT)
})

const result = await Promise.race([logReadPromise, timeoutPromise])
```

### 配置
在 `.env` 文件中配置：
```bash
LOG_READ_TIMEOUT=30000  # 30秒超时
```

### 影响的文件
- `websocket-diagnostic-tools.js` - CommonJS 版本
- `src/lib/ai-diagnostic/tools/get-service-logs.ts` - TypeScript 版本

## 2. WebSocket 心跳检测增强

### 问题
原有心跳机制只发送 ping，但不检测客户端是否响应，导致：
- 死连接占用资源
- 无法及时发现网络问题

### 解决方案
实现了基于计数器的心跳检测：

```javascript
let heartbeatMissed = 0
const MAX_HEARTBEAT_MISSED = 3

// 每次心跳增加计数
heartbeatInterval = setInterval(() => {
  if (heartbeatMissed >= MAX_HEARTBEAT_MISSED) {
    ws.close(1000, 'Heartbeat timeout')
    return
  }
  heartbeatMissed++
  ws.ping()
}, HEARTBEAT_INTERVAL)

// 收到 pong 时重置计数
ws.on('pong', () => {
  heartbeatMissed = 0
  conn.lastActivity = Date.now()
})
```

### 配置
```bash
WS_HEARTBEAT_INTERVAL=30000    # 心跳间隔 30秒
WS_CONNECTION_TIMEOUT=300000   # 连接超时 5分钟
```

### 行为
- 每 30 秒发送一次心跳
- 连续 3 次未收到 pong 响应，关闭连接
- 5 分钟无活动，自动关闭连接

## 3. 并发连接数限制

### 问题
无限制的并发连接会导致：
- 服务器资源耗尽
- 影响其他用户
- 潜在的 DoS 攻击

### 解决方案
实现了基于用户的连接数限制：

```javascript
const MAX_CONNECTIONS_PER_USER = 5
const userConnections = new Map() // userId -> Set<sessionId>

// 检查连接限制
const userSessions = userConnections.get(userId) || new Set()
if (userSessions.size >= MAX_CONNECTIONS_PER_USER) {
  ws.send(JSON.stringify({
    type: 'error',
    payload: {
      message: `连接数已达上限（${MAX_CONNECTIONS_PER_USER}个）`,
      code: 'CONNECTION_LIMIT_REACHED'
    }
  }))
  ws.close(1008, 'Connection limit reached')
  return
}
```

### 配置
```bash
MAX_CONNECTIONS_PER_USER=5  # 每个用户最多 5 个并发连接
```

### 注意事项
- 当前使用 `serviceId` 作为 `userId` 的代理
- 生产环境应该从认证系统获取真实的用户 ID
- 连接关闭时自动清理计数

## 4. 流式响应性能优化

### 问题
原有实现每收到一个 chunk 就立即发送，导致：
- 大量小消息增加网络开销
- WebSocket 帧头开销占比高
- 客户端频繁渲染影响性能

### 解决方案
实现了基于缓冲区的批量发送机制：

```javascript
const CHUNK_BUFFER_SIZE = 5        // 缓冲 5 个 chunk
const CHUNK_FLUSH_INTERVAL = 100   // 100ms 刷新一次

let textBuffer = []
let lastFlush = Date.now()

// 添加到缓冲区
textBuffer.push(chunk.content)

// 满足条件时刷新
const shouldFlush = textBuffer.length >= CHUNK_BUFFER_SIZE || 
                   (Date.now() - lastFlush) >= CHUNK_FLUSH_INTERVAL

if (shouldFlush) {
  const combinedContent = textBuffer.join('')
  ws.send(JSON.stringify({
    type: 'diagnostic_response',
    payload: { content: combinedContent, done: false }
  }))
  textBuffer = []
  lastFlush = Date.now()
}
```

### 配置
```bash
CHUNK_BUFFER_SIZE=5          # 缓冲区大小
CHUNK_FLUSH_INTERVAL=100     # 刷新间隔（毫秒）
DIAGNOSTIC_TIMEOUT=60000     # 诊断超时（毫秒）
```

### 优势
- **减少网络开销**：合并多个小消息为一个大消息
- **降低 CPU 使用**：减少序列化和发送次数
- **改善用户体验**：减少客户端渲染频率
- **保持实时性**：100ms 刷新间隔保证响应及时

### 刷新策略
缓冲区在以下情况下刷新：
1. 缓冲区达到 5 个 chunk
2. 距离上次刷新超过 100ms
3. 收到工具调用消息（确保工具状态及时显示）
4. 流结束时（确保所有内容都被发送）

## 性能指标

### 优化前
- 日志读取：可能无限期阻塞
- 心跳检测：只发送不检测
- 并发连接：无限制
- 消息发送：每个 chunk 一个消息

### 优化后
- 日志读取：30 秒超时保护
- 心跳检测：3 次未响应断开
- 并发连接：每用户最多 5 个
- 消息发送：批量发送，减少 80% 网络消息数

## 监控建议

### 关键指标
1. **连接数**
   - 当前活跃连接数
   - 每用户连接数分布
   - 连接拒绝次数

2. **超时统计**
   - 日志读取超时次数
   - 诊断请求超时次数
   - 心跳超时次数

3. **性能指标**
   - 平均响应时间
   - 消息发送频率
   - 缓冲区命中率

### 日志监控
关键日志消息：
```
[Diagnostic] Connection limit reached for user: xxx
[Diagnostic] Heartbeat timeout for session: xxx
[Diagnostic] Connection timeout for session: xxx
[getServiceLogs] Timeout or error: xxx
```

## 故障排查

### 连接被拒绝
**症状**：用户收到 "连接数已达上限" 错误

**原因**：
- 用户打开了过多诊断面板
- 之前的连接未正常关闭

**解决**：
1. 关闭其他诊断面板
2. 刷新页面
3. 增加 `MAX_CONNECTIONS_PER_USER` 配置

### 日志读取超时
**症状**：用户收到 "日志读取超时" 错误

**原因**：
- Pod 日志量过大
- Kubernetes API 响应慢
- 网络延迟

**解决**：
1. 减少请求的日志行数
2. 使用时间范围过滤（如 "1h"）
3. 增加 `LOG_READ_TIMEOUT` 配置
4. 检查 Kubernetes API 性能

### 心跳超时
**症状**：连接突然断开，日志显示 "Heartbeat timeout"

**原因**：
- 客户端网络不稳定
- 客户端浏览器标签页被挂起
- 防火墙阻止 WebSocket ping/pong

**解决**：
1. 检查网络连接
2. 保持浏览器标签页活跃
3. 增加 `WS_HEARTBEAT_INTERVAL` 配置
4. 检查防火墙规则

## 最佳实践

### 开发环境
```bash
# 宽松的超时设置，便于调试
LOG_READ_TIMEOUT=60000
DIAGNOSTIC_TIMEOUT=120000
WS_HEARTBEAT_INTERVAL=60000
MAX_CONNECTIONS_PER_USER=10
```

### 生产环境
```bash
# 严格的超时设置，保护资源
LOG_READ_TIMEOUT=30000
DIAGNOSTIC_TIMEOUT=60000
WS_HEARTBEAT_INTERVAL=30000
MAX_CONNECTIONS_PER_USER=5
CHUNK_BUFFER_SIZE=5
CHUNK_FLUSH_INTERVAL=100
```

### 高负载环境
```bash
# 更严格的限制
LOG_READ_TIMEOUT=20000
DIAGNOSTIC_TIMEOUT=45000
WS_HEARTBEAT_INTERVAL=20000
MAX_CONNECTIONS_PER_USER=3
CHUNK_BUFFER_SIZE=10
CHUNK_FLUSH_INTERVAL=200
```

## 未来优化方向

1. **自适应超时**
   - 根据历史数据动态调整超时时间
   - 不同服务使用不同的超时配置

2. **连接池管理**
   - 实现连接池复用
   - 优先级队列处理请求

3. **压缩传输**
   - 对大量日志数据启用压缩
   - 减少网络带宽占用

4. **分布式限流**
   - 跨多个服务器实例的全局限流
   - 使用 Redis 共享连接计数

5. **智能缓存**
   - 缓存常见的诊断结果
   - 减少重复的 Kubernetes API 调用

## 相关文档

- [AI 诊断快速开始](./AI_DIAGNOSTIC_QUICK_START.md)
- [AI 诊断故障排查](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)
- [WebSocket 诊断指南](./WEBSOCKET_DIAGNOSTIC_GUIDE.md)

## 变更历史

- 2024-12-05: 初始版本，实现四项核心性能优化
