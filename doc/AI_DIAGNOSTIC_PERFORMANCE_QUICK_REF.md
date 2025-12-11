# AI 诊断性能优化快速参考

## 配置速查表

### 开发环境（宽松配置）
```bash
# .env
LOG_READ_TIMEOUT=60000
DIAGNOSTIC_TIMEOUT=120000
WS_HEARTBEAT_INTERVAL=60000
WS_CONNECTION_TIMEOUT=600000
MAX_CONNECTIONS_PER_USER=10
CHUNK_BUFFER_SIZE=5
CHUNK_FLUSH_INTERVAL=100
```

### 生产环境（推荐配置）
```bash
# .env
LOG_READ_TIMEOUT=30000
DIAGNOSTIC_TIMEOUT=60000
WS_HEARTBEAT_INTERVAL=30000
WS_CONNECTION_TIMEOUT=300000
MAX_CONNECTIONS_PER_USER=5
CHUNK_BUFFER_SIZE=5
CHUNK_FLUSH_INTERVAL=100
```

### 高负载环境（严格配置）
```bash
# .env
LOG_READ_TIMEOUT=20000
DIAGNOSTIC_TIMEOUT=45000
WS_HEARTBEAT_INTERVAL=20000
WS_CONNECTION_TIMEOUT=180000
MAX_CONNECTIONS_PER_USER=3
CHUNK_BUFFER_SIZE=10
CHUNK_FLUSH_INTERVAL=200
```

## 常见问题速查

### 问题：连接被拒绝
```
错误: 连接数已达上限（5个）
```
**解决**:
1. 关闭其他诊断面板
2. 刷新页面
3. 或增加 `MAX_CONNECTIONS_PER_USER`

### 问题：日志读取超时
```
错误: 日志读取超时，请减少行数或缩小时间范围
```
**解决**:
1. 减少请求的日志行数
2. 使用时间范围过滤（如 "1h"）
3. 或增加 `LOG_READ_TIMEOUT`

### 问题：诊断请求超时
```
错误: 诊断请求超时，请稍后重试
```
**解决**:
1. 简化问题描述
2. 检查 AI 服务状态
3. 或增加 `DIAGNOSTIC_TIMEOUT`

### 问题：连接突然断开
```
日志: Heartbeat timeout for session: xxx
```
**解决**:
1. 检查网络连接
2. 保持浏览器标签页活跃
3. 或增加 `WS_HEARTBEAT_INTERVAL`

## 性能指标

| 指标 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 日志读取超时保护 | ❌ 无 | ✅ 30秒 | +100% |
| 心跳检测 | ⚠️ 单向 | ✅ 双向 | +100% |
| 并发连接限制 | ❌ 无限 | ✅ 5个/用户 | +100% |
| 网络消息数 | 100% | 20% | -80% |

## 测试命令

```bash
# 快速测试（跳过心跳测试）
node test-performance-optimizations.js

# 完整测试（包含心跳测试，需要 2 分钟）
TEST_HEARTBEAT=true node test-performance-optimizations.js

# 自定义服务 ID
TEST_SERVICE_ID=your-service-id node test-performance-optimizations.js
```

## 监控命令

```bash
# 查看连接数
grep "New connection" websocket-server.log | wc -l

# 查看连接拒绝
grep "Connection limit reached" websocket-server.log

# 查看超时事件
grep "timeout" websocket-server.log

# 查看心跳问题
grep "Heartbeat timeout" websocket-server.log
```

## 优化效果

### 网络流量
- **优化前**: 每个 AI chunk 一个消息
- **优化后**: 每 5 个 chunk 或 100ms 一个消息
- **效果**: 减少 80% 网络消息数

### 资源保护
- **优化前**: 无限制，可能耗尽资源
- **优化后**: 每用户 5 个连接，超时保护
- **效果**: 防止资源耗尽和 DoS

### 稳定性
- **优化前**: 可能无限期阻塞
- **优化后**: 所有操作都有超时保护
- **效果**: 系统更稳定可靠

## 相关文档

- 📖 [详细文档](./AI_DIAGNOSTIC_PERFORMANCE.md)
- 📋 [实施总结](./TASK_17_PERFORMANCE_OPTIMIZATION_SUMMARY.md)
- 🚀 [快速开始](./AI_DIAGNOSTIC_QUICK_START.md)
- 🔧 [故障排查](./AI_DIAGNOSTIC_TROUBLESHOOTING.md)
