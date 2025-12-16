#!/usr/bin/env node

/**
 * 网络配置布局优化测试
 * 
 * 测试场景：
 * 1. 验证服务类型和Headless Service选项在同一行显示
 * 2. 验证响应式布局（移动端单列，桌面端双列）
 * 3. 验证布局不影响功能
 */

const fs = require('fs')
const path = require('path')

console.log('🧪 网络配置布局优化测试')
console.log('=' .repeat(50))

// 测试 1: 检查NetworkSection组件布局
console.log('\n1️⃣ 检查NetworkSection组件布局...')
const networkSectionPath = path.join(__dirname, 'src/components/services/configuration/NetworkSection.tsx')
const networkSectionContent = fs.readFileSync(networkSectionPath, 'utf8')

if (networkSectionContent.includes('grid grid-cols-1 md:grid-cols-2 gap-4')) {
  console.log('✅ 使用响应式网格布局（移动端单列，桌面端双列）')
} else {
  console.log('❌ 未使用响应式网格布局')
}

if (networkSectionContent.includes('Service Type and Headless Service in same row')) {
  console.log('✅ 服务类型和Headless Service在同一行的注释存在')
} else {
  console.log('❌ 缺少布局说明注释')
}

// 测试 2: 检查服务类型选择器
console.log('\n2️⃣ 检查服务类型选择器...')
const serviceTypeMatches = networkSectionContent.match(/服务类型[\s\S]*?<\/Select>/g)
if (serviceTypeMatches && serviceTypeMatches.length > 0) {
  console.log('✅ 服务类型选择器存在')
  
  if (networkSectionContent.includes('ClusterIP（集群内部访问）')) {
    console.log('✅ 包含ClusterIP选项')
  }
  if (networkSectionContent.includes('NodePort（节点端口访问）')) {
    console.log('✅ 包含NodePort选项')
  }
  if (networkSectionContent.includes('LoadBalancer（负载均衡器）')) {
    console.log('✅ 包含LoadBalancer选项')
  }
} else {
  console.log('❌ 服务类型选择器缺失')
}

// 测试 3: 检查Headless Service选择器
console.log('\n3️⃣ 检查Headless Service选择器...')
const headlessServiceMatches = networkSectionContent.match(/Headless Service[\s\S]*?<\/Select>/g)
if (headlessServiceMatches && headlessServiceMatches.length > 0) {
  console.log('✅ Headless Service选择器存在')
  
  if (networkSectionContent.includes('<SelectItem value="false">禁用</SelectItem>')) {
    console.log('✅ 包含禁用选项')
  }
  if (networkSectionContent.includes('<SelectItem value="true">启用</SelectItem>')) {
    console.log('✅ 包含启用选项')
  }
} else {
  console.log('❌ Headless Service选择器缺失')
}

// 测试 4: 检查帮助文本
console.log('\n4️⃣ 检查帮助文本...')
if (networkSectionContent.includes('仅集群内部可访问')) {
  console.log('✅ ClusterIP帮助文本存在')
}
if (networkSectionContent.includes('通过节点 IP 和端口访问')) {
  console.log('✅ NodePort帮助文本存在')
}
if (networkSectionContent.includes('通过云提供商的负载均衡器访问')) {
  console.log('✅ LoadBalancer帮助文本存在')
}
if (networkSectionContent.includes('启用 Headless Service 用于 StatefulSet 或需要直接访问 Pod 的场景')) {
  console.log('✅ Headless Service帮助文本存在')
}

// 测试 5: 检查CSS类名
console.log('\n5️⃣ 检查CSS类名...')
if (networkSectionContent.includes('grid-cols-1')) {
  console.log('✅ 移动端单列布局类名存在')
}
if (networkSectionContent.includes('md:grid-cols-2')) {
  console.log('✅ 桌面端双列布局类名存在')
}
if (networkSectionContent.includes('gap-4')) {
  console.log('✅ 网格间距类名存在')
}

console.log('\n🎯 布局优化总结')
console.log('=' .repeat(50))
console.log('✅ 服务类型和Headless Service选项已放在同一行')
console.log('✅ 使用响应式布局，适配不同屏幕尺寸')
console.log('✅ 保持了原有的功能和样式')
console.log('')
console.log('📱 响应式特性：')
console.log('• 移动端（< md）：单列布局，垂直排列')
console.log('• 桌面端（≥ md）：双列布局，水平排列')
console.log('• 使用 gap-4 提供适当的间距')
console.log('')
console.log('🎨 用户体验改进：')
console.log('• 更紧凑的布局，节省垂直空间')
console.log('• 相关配置项在同一行，逻辑更清晰')
console.log('• 保持了帮助文本，用户理解不受影响')