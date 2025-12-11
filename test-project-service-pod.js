#!/usr/bin/env node

/**
 * 测试项目-服务-Pod层次结构选择
 */

async function testHierarchy() {
  console.log('🧪 测试项目-服务-Pod层次结构...\n')
  
  try {
    // 1. 测试项目列表
    console.log('📡 获取项目列表...')
    const projectsResponse = await fetch('http://localhost:3000/api/projects')
    const projects = await projectsResponse.json()
    
    if (projects.length > 0) {
      console.log(`✅ 找到 ${projects.length} 个项目`)
      const firstProject = projects[0]
      console.log(`📋 第一个项目: ${firstProject.name} (${firstProject.identifier})`)
      
      // 2. 测试服务列表
      console.log(`\n📡 获取项目 "${firstProject.name}" 的服务列表...`)
      const servicesResponse = await fetch(`http://localhost:3000/api/services?project_id=${firstProject.id}`)
      const services = await servicesResponse.json()
      
      if (services.length > 0) {
        console.log(`✅ 找到 ${services.length} 个服务`)
        const firstService = services[0]
        console.log(`📋 第一个服务: ${firstService.name} (${firstService.type})`)
        
        // 3. 测试Pod列表
        console.log(`\n📡 获取服务 "${firstService.name}" 的Pod列表...`)
        const namespace = firstProject.identifier
        const labelSelector = `app=${firstService.name}`
        
        const podsResponse = await fetch(`http://localhost:3000/api/k8s/pods?namespace=${namespace}&labelSelector=${labelSelector}`)
        const podsData = await podsResponse.json()
        
        if (podsData.success && podsData.pods.length > 0) {
          console.log(`✅ 找到 ${podsData.total} 个Pod`)
          const firstPod = podsData.pods[0]
          console.log(`📋 第一个Pod: ${firstPod.name} (${firstPod.status})`)
          
          // 4. 测试调试会话
          console.log(`\n📡 创建调试会话...`)
          const sessionResponse = await fetch('http://localhost:3000/api/debug/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              podName: firstPod.name,
              namespace: namespace,
              container: firstPod.containers[0] || 'main'
            })
          })
          const sessionData = await sessionResponse.json()
          
          if (sessionData.success) {
            console.log(`✅ 调试会话创建成功: ${sessionData.sessionId}`)
          } else {
            console.log('⚠️ 调试会话创建失败')
          }
          
        } else {
          console.log('⚠️ 没有找到Pod')
        }
      } else {
        console.log('⚠️ 没有找到服务')
      }
    } else {
      console.log('⚠️ 没有找到项目')
    }
    
    console.log('\n🎉 层次结构测试完成!')
    console.log('\n📋 使用说明:')
    console.log('1. 访问 http://localhost:3000/debug')
    console.log('2. 按照 项目 → 服务 → Pod 的顺序选择')
    console.log('3. 启动调试会话')
    console.log('4. 使用各种调试工具')
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

testHierarchy()