/**
 * K8s文件上传测试脚本
 * 用于诊断文件上传问题
 */

const namespace = 'logic-test'
const podName = 'logic-test-jdk17-5fcc498df4-hs854'
const containerName = 'logic-test-jdk17'
const targetPath = '/app'
const testFileName = 'test-from-api.txt'
const testContent = 'Hello from API test'

async function testUpload() {
  console.log('=== K8s文件上传测试 ===\n')
  
  try {
    // 1. 测试列出文件
    console.log('1. 测试列出文件...')
    const listResponse = await fetch(`http://localhost:3000/api/services/024dd1e8-73e4-40e6-87b5-0ca2c8d03e07/files?path=${targetPath}`)
    
    if (!listResponse.ok) {
      const error = await listResponse.json()
      console.error('❌ 列出文件失败:', error)
      return
    }
    
    const listData = await listResponse.json()
    console.log('✅ 列出文件成功:', listData.entries.length, '个条目')
    console.log('   文件列表:', listData.entries.map(e => e.name).join(', '))
    console.log()
    
    // 2. 测试上传文件
    console.log('2. 测试上传文件...')
    const formData = new FormData()
    formData.append('path', targetPath)
    formData.append('file', new Blob([testContent], { type: 'text/plain' }), testFileName)
    
    const uploadResponse = await fetch(`http://localhost:3000/api/services/024dd1e8-73e4-40e6-87b5-0ca2c8d03e07/files`, {
      method: 'POST',
      body: formData
    })
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json()
      console.error('❌ 上传文件失败:', error)
      return
    }
    
    const uploadData = await uploadResponse.json()
    console.log('✅ 上传文件成功:', uploadData)
    console.log()
    
    // 3. 验证文件是否存在
    console.log('3. 验证文件是否存在...')
    const verifyResponse = await fetch(`http://localhost:3000/api/services/024dd1e8-73e4-40e6-87b5-0ca2c8d03e07/files?path=${targetPath}`)
    
    if (!verifyResponse.ok) {
      const error = await verifyResponse.json()
      console.error('❌ 验证失败:', error)
      return
    }
    
    const verifyData = await verifyResponse.json()
    const uploadedFile = verifyData.entries.find(e => e.name === testFileName)
    
    if (uploadedFile) {
      console.log('✅ 文件验证成功:', uploadedFile)
    } else {
      console.error('❌ 未找到上传的文件')
    }
    
    console.log('\n=== 测试完成 ===')
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message)
    console.error('   详细信息:', error)
  }
}

// 运行测试
testUpload()
