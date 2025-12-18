/**
 * 测试数据库默认版本设置
 * 验证MySQL默认版本为8.0.21，Redis默认版本为6.0.8
 */

// 使用全局的 fetch (Node.js 18+)
const fetch = globalThis.fetch || require('node-fetch')

async function testDatabaseDefaultVersions() {
  console.log('🧪 开始测试数据库默认版本设置...')
  
  const baseUrl = 'http://localhost:3000'
  
  try {
    // 1. 获取项目列表
    console.log('📋 获取项目列表...')
    const projectsResponse = await fetch(`${baseUrl}/api/projects`)
    
    if (!projectsResponse.ok) {
      throw new Error(`获取项目列表失败: ${projectsResponse.status}`)
    }
    
    const projects = await projectsResponse.json()
    console.log(`   找到 ${projects.length} 个项目`)
    
    if (projects.length === 0) {
      throw new Error('没有找到项目，无法测试服务创建')
    }
    
    const testProject = projects[0]
    console.log(`   使用项目: ${testProject.name} (ID: ${testProject.id})`)
    
    // 2. 测试创建MySQL服务，验证默认版本8.0.21
    console.log('\n🗄️ 测试创建MySQL服务...')
    const mysqlServiceData = {
      project_id: testProject.id,
      name: 'mysql-version-test',
      type: 'database',
      status: 'pending',
      database_type: 'mysql',
      // 不设置version，让系统使用默认值
      port: 3306,
      password: '1234@qwer',
      volume_size: '10Gi',
      internal_host: 'mysql-version-test',
      username: 'admin',
      database_name: 'tmp',
      root_password: '1234@qwer',
      env_vars: {
        TZ: 'Asia/Shanghai'
      }
    }
    
    const mysqlResponse = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mysqlServiceData)
    })
    
    if (mysqlResponse.ok) {
      const mysqlService = await mysqlResponse.json()
      console.log(`   ✅ MySQL服务创建成功: ${mysqlService.name} (ID: ${mysqlService.id})`)
      console.log(`   📝 MySQL版本: "${mysqlService.version}"`)
      
      if (mysqlService.version === '8.0.21') {
        console.log('   ✅ 验证通过: MySQL默认版本正确设置为8.0.21')
      } else {
        console.log(`   ❌ 验证失败: MySQL版本期望为"8.0.21"，实际为"${mysqlService.version}"`)
      }
    } else {
      const errorText = await mysqlResponse.text()
      console.log(`   ❌ MySQL服务创建失败: ${mysqlResponse.status} - ${errorText}`)
    }
    
    // 3. 测试创建Redis服务，验证默认版本6.0.8
    console.log('\n🔴 测试创建Redis服务...')
    const redisServiceData = {
      project_id: testProject.id,
      name: 'redis-version-test',
      type: 'database',
      status: 'pending',
      database_type: 'redis',
      // 不设置version，让系统使用默认值
      port: 6379,
      password: '1234@qwer',
      volume_size: '10Gi',
      internal_host: 'redis-version-test',
      env_vars: {
        TZ: 'Asia/Shanghai'
      }
    }
    
    const redisResponse = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(redisServiceData)
    })
    
    if (redisResponse.ok) {
      const redisService = await redisResponse.json()
      console.log(`   ✅ Redis服务创建成功: ${redisService.name} (ID: ${redisService.id})`)
      console.log(`   📝 Redis版本: "${redisService.version}"`)
      
      if (redisService.version === '6.0.8') {
        console.log('   ✅ 验证通过: Redis默认版本正确设置为6.0.8')
      } else {
        console.log(`   ❌ 验证失败: Redis版本期望为"6.0.8"，实际为"${redisService.version}"`)
      }
    } else {
      const errorText = await redisResponse.text()
      console.log(`   ❌ Redis服务创建失败: ${redisResponse.status} - ${errorText}`)
    }
    
    console.log('\n🎉 数据库默认版本测试完成!')
    console.log('\n📋 总结:')
    console.log('   - MySQL默认版本: 8.0.21')
    console.log('   - Redis默认版本: 6.0.8')
    console.log('   - 用户仍可手动指定其他版本')
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message)
  }
}

// 运行测试
testDatabaseDefaultVersions().catch(console.error)