#!/usr/bin/env node

/**
 * 测试系统配置布局和Dockerfile模板管理迁移
 * 
 * 功能验证:
 * 1. 系统配置布局 - 左侧菜单，右侧内容区域
 * 2. Git配置页面 - /settings
 * 3. Dockerfile模板配置页面 - /settings/dockerfile-templates
 * 4. 旧路径重定向 - /admin/dockerfile-templates -> /settings/dockerfile-templates
 * 5. 导航菜单更新
 * 
 * 测试方法:
 * 1. 启动开发服务器: npm run dev
 * 2. 访问各个页面验证布局和功能
 */

const BASE_URL = 'http://localhost:3000'

async function testSettingsLayout() {
  console.log('🧪 测试系统配置布局和Dockerfile模板管理迁移')
  console.log('=' .repeat(60))

  try {
    // 1. 测试系统配置主页面
    console.log('\n1. 测试系统配置主页面 (Git配置)')
    const gitConfigResponse = await fetch(`${BASE_URL}/settings`)
    
    if (gitConfigResponse.ok) {
      console.log('✅ Git配置页面可访问')
    } else {
      console.log('❌ Git配置页面访问失败:', gitConfigResponse.status)
    }

    // 2. 测试Dockerfile模板配置页面
    console.log('\n2. 测试Dockerfile模板配置页面')
    const dockerfileTemplatesResponse = await fetch(`${BASE_URL}/settings/dockerfile-templates`)
    
    if (dockerfileTemplatesResponse.ok) {
      console.log('✅ Dockerfile模板配置页面可访问')
    } else {
      console.log('❌ Dockerfile模板配置页面访问失败:', dockerfileTemplatesResponse.status)
    }

    // 3. 测试旧路径重定向
    console.log('\n3. 测试旧路径重定向')
    const oldPathResponse = await fetch(`${BASE_URL}/admin/dockerfile-templates`, {
      redirect: 'manual'
    })
    
    if (oldPathResponse.status === 200) {
      console.log('✅ 旧路径重定向页面可访问 (将自动重定向到新路径)')
    } else {
      console.log('❌ 旧路径重定向失败:', oldPathResponse.status)
    }

    // 4. 测试API端点 (确保API路径未受影响)
    console.log('\n4. 测试API端点')
    const apiResponse = await fetch(`${BASE_URL}/api/dockerfile-templates`)
    
    if (apiResponse.ok) {
      console.log('✅ Dockerfile模板API端点正常')
    } else {
      console.log('❌ Dockerfile模板API端点异常:', apiResponse.status)
    }

    console.log('\n🎉 系统配置布局测试完成!')
    console.log('\n📋 新的访问方式:')
    console.log(`   - Git配置: ${BASE_URL}/settings`)
    console.log(`   - Dockerfile模板配置: ${BASE_URL}/settings/dockerfile-templates`)
    console.log(`   - 项目管理: ${BASE_URL}/projects (有"系统配置"按钮)`)
    
    console.log('\n🔧 布局特性:')
    console.log('   - 左侧菜单: Git配置、Dockerfile模板配置')
    console.log('   - 右侧内容区域: 对应的配置页面')
    console.log('   - 响应式设计: 移动端使用抽屉式菜单')
    console.log('   - 导航栏更新: 模板管理链接指向新路径')
    
    console.log('\n📱 移动端适配:')
    console.log('   - 顶部显示汉堡菜单按钮')
    console.log('   - 点击打开侧边抽屉菜单')
    console.log('   - 桌面端显示固定侧边栏')

  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error.message)
  }
}

// 运行测试
testSettingsLayout()

console.log('\n💡 手动测试步骤:')
console.log('1. 启动开发服务器: npm run dev')
console.log('2. 访问项目管理页面，点击"系统配置"按钮')
console.log('3. 验证左侧菜单显示: Git配置、Dockerfile模板')
console.log('4. 点击菜单项验证页面切换')
console.log('5. 在移动端模拟器中测试响应式布局')
console.log('6. 验证导航栏中的"模板管理"链接指向新路径')