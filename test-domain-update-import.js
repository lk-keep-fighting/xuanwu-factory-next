/**
 * 测试导入服务时域名配置自动更新功能
 * 
 * 功能说明：
 * 当从其他项目导入服务配置时，如果原服务开启了域名访问，
 * 系统会自动将域名配置更新为新项目的子域名。
 * 
 * 示例：
 * - 原项目标识符：demo
 * - 原服务域名：loong-web.demo.dev.aimstek.cn
 * - 新项目标识符：bggs-pre  
 * - 更新后域名：loong-web.bggs-pre.dev.aimstek.cn
 * 
 * 实现逻辑：
 * 1. 检查服务的network_config配置
 * 2. 遍历ports数组中的每个端口配置
 * 3. 如果端口配置中有domain且enabled为true
 * 4. 保持domain.prefix不变，更新domain.host为新的项目子域名
 * 5. 新域名格式：{prefix}.{新项目标识符}.dev.aimstek.cn
 * 
 * 测试场景：
 * 1. 导入没有域名配置的服务 - 应该正常导入，不做任何域名处理
 * 2. 导入有域名配置但未启用的服务 - 应该保持原配置不变
 * 3. 导入有启用域名配置的服务 - 应该自动更新域名为新项目子域名
 * 4. 导入多个端口都有域名配置的服务 - 应该更新所有端口的域名配置
 * 
 * 验证方法：
 * 1. 在demo项目中创建一个开启域名访问的服务
 * 2. 记录原始域名配置
 * 3. 将该服务导入到bggs-pre项目
 * 4. 检查导入后的服务网络配置
 * 5. 验证域名是否正确更新为新项目的子域名
 */

console.log('域名配置自动更新功能测试')

// 模拟测试数据
const originalNetworkConfig = {
  service_type: 'NodePort',
  ports: [
    {
      container_port: 80,
      service_port: 80,
      protocol: 'TCP',
      domain: {
        enabled: true,
        prefix: 'loong-web',
        host: 'loong-web.demo.dev.aimstek.cn'
      }
    },
    {
      container_port: 443,
      service_port: 443,
      protocol: 'TCP',
      domain: {
        enabled: true,
        prefix: 'loong-web-ssl',
        host: 'loong-web-ssl.demo.dev.aimstek.cn'
      }
    }
  ]
}

const expectedUpdatedConfig = {
  service_type: 'NodePort',
  ports: [
    {
      container_port: 80,
      service_port: 80,
      protocol: 'TCP',
      domain: {
        enabled: true,
        prefix: 'loong-web',
        host: 'loong-web.bggs-pre.dev.aimstek.cn'
      }
    },
    {
      container_port: 443,
      service_port: 443,
      protocol: 'TCP',
      domain: {
        enabled: true,
        prefix: 'loong-web-ssl',
        host: 'loong-web-ssl.bggs-pre.dev.aimstek.cn'
      }
    }
  ]
}

console.log('原始网络配置:', JSON.stringify(originalNetworkConfig, null, 2))
console.log('期望更新后配置:', JSON.stringify(expectedUpdatedConfig, null, 2))
console.log('请在浏览器中测试实际的导入功能验证域名更新是否正确')