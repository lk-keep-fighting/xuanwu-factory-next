'use client'

import { useEffect, useState } from 'react'
import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

/**
 * 开放API文档页面
 * 使用Swagger UI展示OpenAPI规范
 */
export default function OpenApiDocsPage() {
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        const response = await fetch('/api/open-api/docs')
        if (!response.ok) {
          throw new Error('Failed to fetch API specification')
        }
        const data = await response.json()
        setSpec(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchSpec()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载API文档中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">加载失败</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">玄武工厂开放API文档</h1>
              <p className="text-gray-600 mt-1">用于外部系统集成的开放API接口文档</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                v1.0.0
              </span>
              <a
                href="/api/open-api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                健康检查
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* API文档内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          {/* 使用说明 */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">使用说明</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">认证方式</h3>
                <p className="text-sm text-gray-600 mb-2">
                  所有开放API接口都需要在请求头中提供API密钥：
                </p>
                <code className="block bg-gray-100 p-2 rounded text-sm">
                  x-api-key: YOUR_API_KEY
                </code>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">基础URL</h3>
                <p className="text-sm text-gray-600 mb-2">
                  所有开放API接口的基础URL为：
                </p>
                <code className="block bg-gray-100 p-2 rounded text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/open-api
                </code>
              </div>
            </div>
          </div>

          {/* Swagger UI */}
          <div className="swagger-container">
            {spec && (
              <SwaggerUI
                spec={spec}
                docExpansion="list"
                defaultModelsExpandDepth={2}
                defaultModelExpandDepth={2}
                displayRequestDuration={true}
                tryItOutEnabled={true}
                requestInterceptor={(request: any) => {
                  // 自动添加API密钥到请求头
                  const apiKey = localStorage.getItem('open-api-key')
                  if (apiKey) {
                    request.headers['x-api-key'] = apiKey
                  }
                  return request
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* API密钥设置弹窗 */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => {
            const apiKey = prompt('请输入您的API密钥（用于测试接口）:')
            if (apiKey) {
              localStorage.setItem('open-api-key', apiKey)
              alert('API密钥已保存，现在可以测试接口了')
            }
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          设置API密钥
        </button>
      </div>

      <style jsx global>{`
        .swagger-container .swagger-ui {
          font-family: inherit;
        }
        .swagger-container .swagger-ui .topbar {
          display: none;
        }
        .swagger-container .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-container .swagger-ui .scheme-container {
          background: #fafafa;
          padding: 10px;
          margin: 20px 0;
        }
      `}</style>
    </div>
  )
}