import { NextResponse } from 'next/server'

/**
 * 开放API文档接口
 * 返回OpenAPI 3.0规范的JSON文档
 */
export async function GET() {
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: '玄武工厂开放API',
      description: '玄武工厂系统的开放API接口，用于外部系统集成',
      version: '1.0.0',
      contact: {
        name: 'API支持',
        email: 'support@xuanwu-factory.com'
      }
    },
    servers: [
      {
        url: '/api/open-api',
        description: '开放API服务器'
      }
    ],
    security: [
      {
        ApiKeyAuth: []
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API密钥，请联系管理员获取'
        }
      },
      schemas: {
        ServiceDiagnostic: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '诊断记录ID',
              example: 'diag-123e4567-e89b-12d3-a456-426614174000'
            },
            serviceId: {
              type: 'string',
              description: '服务ID',
              example: 'svc-123e4567-e89b-12d3-a456-426614174000'
            },
            diagnosticTime: {
              type: 'string',
              format: 'date-time',
              description: '诊断时间',
              example: '2024-01-15T10:30:00Z'
            },
            conclusion: {
              type: 'string',
              maxLength: 255,
              description: '诊断结论',
              example: '服务运行正常'
            },
            diagnostician: {
              type: 'string',
              description: '诊断人员',
              example: '张三 (监控系统)'
            },
            reportCategory: {
              type: 'string',
              enum: ['应用问题', '基础设施', '网络问题', '存储问题', '配置问题', '性能问题', '安全问题', '其他'],
              description: '归因分类',
              example: '性能问题'
            },
            reportDetail: {
              type: 'string',
              description: '详细报告内容，支持Markdown格式',
              example: '## 性能分析\\n\\n- CPU使用率: 85%\\n- 内存使用率: 70%\\n- 响应时间: 200ms'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间',
              example: '2024-01-15T10:30:00Z'
            }
          },
          required: ['conclusion', 'diagnostician', 'reportCategory', 'reportDetail']
        },
        CreateDiagnosticRequest: {
          type: 'object',
          properties: {
            conclusion: {
              type: 'string',
              maxLength: 255,
              description: '诊断结论',
              example: '服务运行正常'
            },
            diagnostician: {
              type: 'string',
              description: '诊断人员姓名',
              example: '张三'
            },
            reportCategory: {
              type: 'string',
              enum: ['应用问题', '基础设施', '网络问题', '存储问题', '配置问题', '性能问题', '安全问题', '其他'],
              description: '归因分类',
              example: '性能问题'
            },
            reportDetail: {
              type: 'string',
              description: '详细报告内容，支持Markdown格式',
              example: '## 性能分析\\n\\n- CPU使用率: 85%\\n- 内存使用率: 70%\\n- 响应时间: 200ms'
            },
            diagnosticTime: {
              type: 'string',
              format: 'date-time',
              description: '诊断时间，可选，默认为当前时间',
              example: '2024-01-15T10:30:00Z'
            },
            source: {
              type: 'string',
              description: '数据来源标识，可选',
              example: '监控系统'
            }
          },
          required: ['conclusion', 'diagnostician', 'reportCategory', 'reportDetail']
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: '请求是否成功'
            },
            data: {
              type: 'object',
              description: '响应数据'
            },
            message: {
              type: 'string',
              description: '响应消息'
            }
          }
        },
        ApiError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: '错误类型'
            },
            message: {
              type: 'string',
              description: '错误消息'
            }
          }
        },
        PaginationInfo: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: '当前页码',
              example: 1
            },
            limit: {
              type: 'integer',
              description: '每页条数',
              example: 20
            },
            total: {
              type: 'integer',
              description: '总记录数',
              example: 100
            },
            totalPages: {
              type: 'integer',
              description: '总页数',
              example: 5
            },
            hasNext: {
              type: 'boolean',
              description: '是否有下一页',
              example: true
            },
            hasPrevious: {
              type: 'boolean',
              description: '是否有上一页',
              example: false
            }
          }
        }
      }
    },
    paths: {
      '/services/{serviceId}/diagnostics': {
        post: {
          summary: '创建服务诊断记录',
          description: '为指定服务创建新的诊断记录，用于外部系统添加诊断数据',
          tags: ['服务诊断'],
          parameters: [
            {
              name: 'serviceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: '服务ID',
              example: 'svc-123e4567-e89b-12d3-a456-426614174000'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateDiagnosticRequest'
                }
              }
            }
          },
          responses: {
            '200': {
              description: '诊断记录创建成功',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            $ref: '#/components/schemas/ServiceDiagnostic'
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            '400': {
              description: '请求参数错误',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            },
            '401': {
              description: 'API密钥无效或缺失',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            },
            '404': {
              description: '服务不存在',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            },
            '500': {
              description: '服务器内部错误',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            }
          }
        },
        get: {
          summary: '获取服务诊断记录列表',
          description: '获取指定服务的诊断记录列表，支持分页',
          tags: ['服务诊断'],
          parameters: [
            {
              name: 'serviceId',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: '服务ID',
              example: 'svc-123e4567-e89b-12d3-a456-426614174000'
            },
            {
              name: 'page',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1
              },
              description: '页码',
              example: 1
            },
            {
              name: 'limit',
              in: 'query',
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 20
              },
              description: '每页条数，最大100',
              example: 20
            }
          ],
          responses: {
            '200': {
              description: '获取成功',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/ApiResponse' },
                      {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              diagnostics: {
                                type: 'array',
                                items: {
                                  $ref: '#/components/schemas/ServiceDiagnostic'
                                }
                              },
                              pagination: {
                                $ref: '#/components/schemas/PaginationInfo'
                              }
                            }
                          }
                        }
                      }
                    ]
                  }
                }
              }
            },
            '401': {
              description: 'API密钥无效或缺失',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            },
            '404': {
              description: '服务不存在',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            },
            '500': {
              description: '服务器内部错误',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/ApiError'
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return NextResponse.json(openApiSpec)
}