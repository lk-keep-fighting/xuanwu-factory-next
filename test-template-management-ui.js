#!/usr/bin/env node

/**
 * 测试模版管理界面功能
 */

const BASE_URL = 'http://localhost:3000'

async function testTemplateManagementUI() {
  console.log('🧪 测试模版管理界面功能...\n')

  try {
    // 1. 测试页面是否可访问
    console.log('1. 测试模版管理页面访问')
    const pageResponse = await fetch(`${BASE_URL}/admin/dockerfile-templates`)
    
    if (pageResponse.ok) {
      console.log('✅ 模版管理页面可以访问')
      const pageContent = await pageResponse.text()
      
      // 检查页面是否包含关键元素
      if (pageContent.includes('Dockerfile模版管理')) {
        console.log('✅ 页面标题正确')
      } else {
        console.log('⚠️  页面标题未找到')
      }
      
      if (pageContent.includes('新建模版')) {
        console.log('✅ 新建模版按钮存在')
      } else {
        console.log('⚠️  新建模版按钮未找到')
      }
    } else {
      console.log(`❌ 页面访问失败: ${pageResponse.status}`)
    }

    // 2. 测试API数据获取
    console.log('\n2. 测试API数据获取')
    const apiResponse = await fetch(`${BASE_URL}/api/dockerfile-templates`)
    const apiData = await apiResponse.json()
    
    if (apiData.success) {
      console.log(`✅ API返回 ${apiData.data.length} 个模版`)
      
      // 显示模版列表
      console.log('   模版列表:')
      apiData.data.forEach((template, index) => {
        console.log(`   ${index + 1}. ${template.name} (${template.category})`)
      })
    } else {
      console.log(`❌ API调用失败: ${apiData.error}`)
    }

    // 3. 测试分类API
    console.log('\n3. 测试分类API')
    const categoriesResponse = await fetch(`${BASE_URL}/api/dockerfile-templates/categories`)
    const categoriesData = await categoriesResponse.json()
    
    if (categoriesData.success) {
      console.log(`✅ 获取到 ${categoriesData.data.length} 个分类`)
      categoriesData.data.forEach(cat => {
        console.log(`   - ${cat.label}: ${cat.count} 个模版`)
      })
    } else {
      console.log(`❌ 分类API调用失败: ${categoriesData.error}`)
    }

    // 4. 测试导航链接
    console.log('\n4. 测试导航链接')
    const projectsPageResponse = await fetch(`${BASE_URL}/projects`)
    if (projectsPageResponse.ok) {
      const projectsContent = await projectsPageResponse.text()
      if (projectsContent.includes('模版管理')) {
        console.log('✅ 导航栏包含模版管理链接')
      } else {
        console.log('⚠️  导航栏未找到模版管理链接')
      }
    }

    console.log('\n🎉 模版管理界面测试完成!')
    console.log('\n📋 访问方式:')
    console.log(`   - 直接访问: ${BASE_URL}/admin/dockerfile-templates`)
    console.log('   - 通过导航栏: 项目管理页面 → 模版管理')
    console.log('\n🔧 功能说明:')
    console.log('   - 查看所有模版和分类统计')
    console.log('   - 搜索和筛选模版')
    console.log('   - 新建、编辑、复制、删除模版')
    console.log('   - 查看模版详情和Dockerfile内容')
    console.log('   - 复制和下载Dockerfile文件')

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 提示: 请确保开发服务器正在运行 (npm run dev)')
    }
  }
}

// 运行测试
testTemplateManagementUI()