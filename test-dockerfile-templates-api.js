#!/usr/bin/env node

/**
 * 测试Dockerfile模板API
 */

const BASE_URL = 'http://localhost:3000'

async function testAPI() {
  console.log('🧪 测试Dockerfile模板API...\n')

  try {
    // 测试获取所有模板
    console.log('1. 测试获取所有模板')
    const templatesResponse = await fetch(`${BASE_URL}/api/dockerfile-templates`)
    const templatesData = await templatesResponse.json()
    
    if (templatesData.success) {
      console.log(`✅ 成功获取 ${templatesData.data.length} 个模板`)
      console.log(`   模板列表: ${templatesData.data.map(t => t.name).join(', ')}`)
    } else {
      console.log(`❌ 获取模板失败: ${templatesData.error}`)
    }

    // 测试获取分类
    console.log('\n2. 测试获取模板分类')
    const categoriesResponse = await fetch(`${BASE_URL}/api/dockerfile-templates/categories`)
    const categoriesData = await categoriesResponse.json()
    
    if (categoriesData.success) {
      console.log(`✅ 成功获取 ${categoriesData.data.length} 个分类`)
      categoriesData.data.forEach(cat => {
        console.log(`   ${cat.label}: ${cat.count} 个模板`)
      })
    } else {
      console.log(`❌ 获取分类失败: ${categoriesData.error}`)
    }

    // 测试获取特定模板
    console.log('\n3. 测试获取特定模板 (pnpm-frontend)')
    const templateResponse = await fetch(`${BASE_URL}/api/dockerfile-templates/pnpm-frontend`)
    const templateData = await templateResponse.json()
    
    if (templateData.success) {
      console.log(`✅ 成功获取模板: ${templateData.data.name}`)
      console.log(`   描述: ${templateData.data.description}`)
      console.log(`   分类: ${templateData.data.category}`)
      console.log(`   基础镜像: ${templateData.data.baseImage}`)
    } else {
      console.log(`❌ 获取模板失败: ${templateData.error}`)
    }

    // 测试按分类获取模板
    console.log('\n4. 测试按分类获取模板 (前端)')
    const categoryTemplatesResponse = await fetch(`${BASE_URL}/api/dockerfile-templates?category=前端`)
    const categoryTemplatesData = await categoryTemplatesResponse.json()
    
    if (categoryTemplatesData.success) {
      console.log(`✅ 成功获取前端分类 ${categoryTemplatesData.data.length} 个模板`)
      categoryTemplatesData.data.forEach(template => {
        console.log(`   - ${template.name}`)
      })
    } else {
      console.log(`❌ 获取分类模板失败: ${categoryTemplatesData.error}`)
    }

    console.log('\n🎉 API测试完成!')

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 提示: 请确保开发服务器正在运行 (npm run dev)')
    }
  }
}

// 运行测试
testAPI()