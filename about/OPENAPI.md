# 玄武工厂开放API文档

## 概述

玄武工厂开放API为外部系统提供了集成接口，允许第三方系统与玄武工厂平台进行数据交互。当前版本主要支持服务诊断数据的创建和查询。

## 基础信息

- **API版本**: v1.0.0
- **基础URL**: `/api/open-api`
- **认证方式**: API密钥（Header: `x-api-key`）
- **数据格式**: JSON
- **字符编码**: UTF-8

## 认证

所有开放API接口都需要在请求头中提供API密钥：

```http
x-api-key: YOUR_API_KEY
```

### 获取API密钥

请联系系统管理员获取API密钥。API密钥需要在环境变量中配置：

```bash
OPEN_API_KEY="your-secure-api-key-here"
```

## 接口列表

### 1. 健康检查

检查开放API服务的可用性。

**请求**
```http
GET /api/open-api/health
```

**响应**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "api": "healthy"
  }
}
```

### 2. 创建服务诊断记录

为指定服务创建新的诊断记录。

**请求**
```http
POST /api/open-api/services/{serviceId}/diagnostics
Content-Type: application/json
x-api-key: YOUR_API_KEY

{
  "conclusion": "服务运行正常",
  "diagnostician": "监控系统",
  "reportCategory": "性能问题",
  "reportDetail": "## 性能分析\n\n- CPU使用率: 85%\n- 内存使用率: 70%\n- 响应时间: 200ms",
  "diagnosticTime": "2024-01-15T10:30:00Z",
  "source": "自动监控"
}
```

**参数说明**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| conclusion | string | 是 | 诊断结论，最大255字符 |
| diagnostician | string | 是 | 诊断人员姓名 |
| reportCategory | string | 是 | 归因分类，见下方枚举值 |
| reportDetail | string | 是 | 详细报告，支持Markdown格式 |
| diagnosticTime | string | 否 | 诊断时间，ISO 8601格式，默认当前时间 |
| source | string | 否 | 数据来源标识 |

**归因分类枚举值**
- `应用问题`
- `基础设施`
- `网络问题`
- `存储问题`
- `配置问题`
- `性能问题`
- `安全问题`
- `其他`

**响应**
```json
{
  "success": true,
  "data": {
    "id": "diag-123e4567-e89b-12d3-a456-426614174000",
    "serviceId": "svc-123e4567-e89b-12d3-a456-426614174000",
    "diagnosticTime": "2024-01-15T10:30:00Z",
    "conclusion": "服务运行正常",
    "diagnostician": "监控系统 (自动监控)",
    "reportCategory": "性能问题",
    "reportDetail": "## 性能分析\n\n- CPU使用率: 85%\n- 内存使用率: 70%\n- 响应时间: 200ms",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "诊断记录创建成功",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 3. 获取服务诊断记录列表

获取指定服务的诊断记录列表，支持分页。

**请求**
```http
GET /api/open-api/services/{serviceId}/diagnostics?page=1&limit=20
x-api-key: YOUR_API_KEY
```

**查询参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | integer | 否 | 1 | 页码，从1开始 |
| limit | integer | 否 | 20 | 每页条数，最大100 |

**响应**
```json
{
  "success": true,
  "data": {
    "diagnostics": [
      {
        "id": "diag-123e4567-e89b-12d3-a456-426614174000",
        "serviceId": "svc-123e4567-e89b-12d3-a456-426614174000",
        "diagnosticTime": "2024-01-15T10:30:00Z",
        "conclusion": "服务运行正常",
        "diagnostician": "监控系统 (自动监控)",
        "reportCategory": "性能问题",
        "reportDetail": "## 性能分析\n\n- CPU使用率: 85%\n- 内存使用率: 70%\n- 响应时间: 200ms",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrevious": false
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 错误处理

所有错误响应都遵循统一格式：

```json
{
  "error": "错误类型",
  "message": "错误描述",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/open-api/services/xxx/diagnostics"
}
```

### 常见错误码

| HTTP状态码 | 错误类型 | 说明 |
|------------|----------|------|
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | API密钥无效或缺失 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

### 错误示例

**API密钥缺失**
```json
{
  "error": "Missing API key",
  "message": "缺少API密钥，请在请求头中提供 x-api-key",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**服务不存在**
```json
{
  "error": "Service not found",
  "message": "服务不存在",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**参数验证失败**
```json
{
  "error": "Missing required fields",
  "message": "缺少必填字段: conclusion, diagnostician",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 使用示例

### cURL示例

```bash
# 创建诊断记录
curl -X POST "https://your-domain.com/api/open-api/services/svc-123/diagnostics" \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "conclusion": "服务运行正常",
    "diagnostician": "监控系统",
    "reportCategory": "性能问题",
    "reportDetail": "## 性能分析\n\n- CPU使用率: 85%\n- 内存使用率: 70%",
    "source": "自动监控"
  }'

# 获取诊断记录列表
curl -X GET "https://your-domain.com/api/open-api/services/svc-123/diagnostics?page=1&limit=10" \
  -H "x-api-key: your-api-key"
```

### JavaScript示例

```javascript
const API_BASE = 'https://your-domain.com/api/open-api'
const API_KEY = 'your-api-key'

// 创建诊断记录
async function createDiagnostic(serviceId, diagnosticData) {
  const response = await fetch(`${API_BASE}/services/${serviceId}/diagnostics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify(diagnosticData)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }
  
  return response.json()
}

// 获取诊断记录列表
async function getDiagnostics(serviceId, page = 1, limit = 20) {
  const response = await fetch(`${API_BASE}/services/${serviceId}/diagnostics?page=${page}&limit=${limit}`, {
    headers: {
      'x-api-key': API_KEY
    }
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }
  
  return response.json()
}

// 使用示例
try {
  const result = await createDiagnostic('svc-123', {
    conclusion: '服务运行正常',
    diagnostician: '监控系统',
    reportCategory: '性能问题',
    reportDetail: '## 性能分析\n\n- CPU使用率: 85%',
    source: '自动监控'
  })
  console.log('诊断记录创建成功:', result)
} catch (error) {
  console.error('创建失败:', error.message)
}
```

### Python示例

```python
import requests
import json

API_BASE = 'https://your-domain.com/api/open-api'
API_KEY = 'your-api-key'

def create_diagnostic(service_id, diagnostic_data):
    """创建诊断记录"""
    url = f'{API_BASE}/services/{service_id}/diagnostics'
    headers = {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
    }
    
    response = requests.post(url, headers=headers, json=diagnostic_data)
    
    if not response.ok:
        error = response.json()
        raise Exception(error.get('message', 'Unknown error'))
    
    return response.json()

def get_diagnostics(service_id, page=1, limit=20):
    """获取诊断记录列表"""
    url = f'{API_BASE}/services/{service_id}/diagnostics'
    headers = {'x-api-key': API_KEY}
    params = {'page': page, 'limit': limit}
    
    response = requests.get(url, headers=headers, params=params)
    
    if not response.ok:
        error = response.json()
        raise Exception(error.get('message', 'Unknown error'))
    
    return response.json()

# 使用示例
try:
    result = create_diagnostic('svc-123', {
        'conclusion': '服务运行正常',
        'diagnostician': '监控系统',
        'reportCategory': '性能问题',
        'reportDetail': '## 性能分析\n\n- CPU使用率: 85%',
        'source': '自动监控'
    })
    print('诊断记录创建成功:', result)
except Exception as e:
    print('创建失败:', str(e))
```

## 最佳实践

### 1. 安全性
- 妥善保管API密钥，不要在代码中硬编码
- 使用HTTPS协议传输数据
- 定期轮换API密钥

### 2. 错误处理
- 始终检查HTTP状态码
- 解析错误响应中的详细信息
- 实现适当的重试机制

### 3. 性能优化
- 使用分页获取大量数据
- 避免频繁请求，考虑批量操作
- 实现客户端缓存机制

### 4. 数据质量
- 提供有意义的诊断结论和详细报告
- 使用标准的时间格式（ISO 8601）
- 选择合适的归因分类

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本发布
- 支持服务诊断记录的创建和查询
- 提供健康检查接口
- 完整的API文档和示例

## 支持与反馈

如有问题或建议，请联系：
- 邮箱: support@xuanwu-factory.com
- 文档: [在线API文档](/open-api-docs)
- 健康检查: [/api/open-api/health](/api/open-api/health)