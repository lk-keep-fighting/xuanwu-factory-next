#!/usr/bin/env node

/**
 * 测试 Metrics API 是否可用
 * 使用方法: node scripts/test-metrics.js <serviceName> <namespace>
 */

const https = require('https')
const { KubeConfig } = require('@kubernetes/client-node')

async function testMetrics(serviceName, namespace = 'xuanwu-factory') {
  const kc = new KubeConfig()
  kc.loadFromDefault()

  const cluster = kc.getCurrentCluster()
  if (!cluster) {
    console.error('❌ 无法获取集群信息')
    process.exit(1)
  }

  // 配置 HTTPS Agent 支持自签名证书
  if (cluster.skipTLSVerify || !cluster.caData) {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    })
    kc.requestOptions = { httpsAgent }
    console.log('⚠️  TLS 证书验证已禁用（自签名证书）')
  }

  console.log(`✓ 集群: ${cluster.name}`)
  console.log(`✓ API Server: ${cluster.server}`)
  console.log(`✓ 测试服务: ${serviceName} (namespace: ${namespace})`)
  console.log('')

  // Step 1: 获取 Pod 列表
  console.log('Step 1: 获取 Pod 列表...')
  const coreApi = kc.makeApiClient(require('@kubernetes/client-node').CoreV1Api)
  
  try {
    const pods = await coreApi.listNamespacedPod({
      namespace,
      labelSelector: `app=${serviceName}`
    })

    if (!pods.items.length) {
      console.error(`❌ 未找到 Pod (label: app=${serviceName})`)
      process.exit(1)
    }

    console.log(`✓ 找到 ${pods.items.length} 个 Pod`)
    
    const runningPod = pods.items.find(p => p.status?.phase === 'Running')
    if (!runningPod) {
      console.error('❌ 未找到 Running 状态的 Pod')
      process.exit(1)
    }

    const podName = runningPod.metadata?.name
    console.log(`✓ Running Pod: ${podName}`)
    console.log('')

    // Step 2: 调用 Metrics API
    console.log('Step 2: 调用 Metrics API...')
    const metricsPath = `/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${podName}`
    console.log(`  URL: ${cluster.server}${metricsPath}`)

    const requestOptions = await kc.applyToHTTPSOptions({})
    const url = new URL(metricsPath, cluster.server)

    const reqOptions = {
      ...requestOptions,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      agent: kc.requestOptions?.httpsAgent || requestOptions.agent
    }

    const data = await new Promise((resolve, reject) => {
      const req = https.request(reqOptions, (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body))
            } catch (err) {
              reject(new Error(`解析 JSON 失败: ${err.message}`))
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`))
          }
        })
      })

      req.on('error', (err) => {
        reject(err)
      })

      req.end()
    })

    if (!data || !data.containers?.length) {
      console.error('❌ Metrics API 返回数据为空')
      process.exit(1)
    }

    console.log(`✓ Metrics API 响应成功`)
    console.log('')

    // Step 3: 解析并显示结果
    console.log('Step 3: 解析 Metrics 数据...')
    const container = data.containers[0]
    const cpuUsed = container.usage?.cpu || '0'
    const memoryUsed = container.usage?.memory || '0'

    console.log(`  容器名: ${container.name}`)
    console.log(`  CPU 使用: ${cpuUsed}`)
    console.log(`  内存使用: ${memoryUsed}`)
    console.log('')

    // Step 4: 获取资源限制
    console.log('Step 4: 获取资源限制...')
    const mainContainer = runningPod.spec?.containers?.[0]
    const cpuLimit = mainContainer?.resources?.limits?.cpu
    const memoryLimit = mainContainer?.resources?.limits?.memory

    if (cpuLimit || memoryLimit) {
      console.log(`  CPU 限制: ${cpuLimit || '未设置'}`)
      console.log(`  内存限制: ${memoryLimit || '未设置'}`)
    } else {
      console.log('  ⚠️  未设置资源限制')
    }
    console.log('')

    console.log('✅ 测试完成！Metrics API 可用')
    console.log('')
    console.log('📊 完整响应数据:')
    console.log(JSON.stringify(data, null, 2))

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    if (error.response) {
      console.error('  响应状态:', error.response.statusCode)
      console.error('  响应体:', error.response.body)
    }
    process.exit(1)
  }
}

// 命令行参数
const serviceName = process.argv[2]
const namespace = process.argv[3] || 'xuanwu-factory'

if (!serviceName) {
  console.error('使用方法: node scripts/test-metrics.js <serviceName> [namespace]')
  console.error('示例: node scripts/test-metrics.js xuanwu-factory-next xuanwu-factory')
  process.exit(1)
}

testMetrics(serviceName, namespace).catch(err => {
  console.error('未处理的错误:', err)
  process.exit(1)
})
