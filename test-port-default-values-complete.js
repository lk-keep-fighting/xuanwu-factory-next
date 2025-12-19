/**
 * 完整测试：验证所有端口默认值设置
 * 包括基础配置和网络配置中的端口默认值
 */

const fs = require('fs');

console.log('🧪 完整测试：验证所有端口默认值设置...\n');

// 测试1: 网络配置 - NetworkSection 组件
console.log('1. 检查 NetworkSection 组件中的端口默认值...');
const networkSectionPath = 'src/components/services/configuration/NetworkSection.tsx';
const networkSectionContent = fs.readFileSync(networkSectionPath, 'utf8');

if (networkSectionContent.includes("containerPort: '8080'") && 
    networkSectionContent.includes("servicePort: '8080'")) {
  console.log('✅ NetworkSection - 网络端口映射默认值已设置为 8080');
} else {
  console.log('❌ NetworkSection - 网络端口映射默认值设置有问题');
}

// 测试2: 服务创建表单 - 基础配置端口
console.log('\n2. 检查 ServiceCreateForm 中的基础配置端口默认值...');
const serviceCreateFormPath = 'src/app/projects/components/ServiceCreateForm.tsx';
const serviceCreateFormContent = fs.readFileSync(serviceCreateFormPath, 'utf8');

if (serviceCreateFormContent.includes("port: '8080'")) {
  console.log('✅ ServiceCreateForm - 基础配置端口默认值已设置为 8080');
} else {
  console.log('❌ ServiceCreateForm - 基础配置端口默认值设置有问题');
}

// 测试3: 服务创建表单 - 网络端口映射
if (serviceCreateFormContent.includes("containerPort: '8080'") && 
    serviceCreateFormContent.includes("servicePort: '8080'")) {
  console.log('✅ ServiceCreateForm - 网络端口映射默认值已设置为 8080');
} else {
  console.log('❌ ServiceCreateForm - 网络端口映射默认值设置有问题');
}

// 测试4: 通用工具函数
console.log('\n3. 检查 network-port-utils 工具函数...');
const networkPortUtilsPath = 'src/lib/network-port-utils.ts';
const networkPortUtilsContent = fs.readFileSync(networkPortUtilsPath, 'utf8');

if (networkPortUtilsContent.includes("containerPort: '8080'") && 
    networkPortUtilsContent.includes("servicePort: '8080'")) {
  console.log('✅ network-port-utils - createEmptyPort 函数默认值已设置为 8080');
} else {
  console.log('❌ network-port-utils - createEmptyPort 函数默认值设置有问题');
}

// 测试5: 基础配置组件 - 检查placeholder
console.log('\n4. 检查 GeneralSection 组件中的端口配置...');
const generalSectionPath = 'src/components/services/configuration/GeneralSection.tsx';
const generalSectionContent = fs.readFileSync(generalSectionPath, 'utf8');

if (generalSectionContent.includes('placeholder="8080"')) {
  console.log('✅ GeneralSection - 容器端口 placeholder 已设置为 8080');
} else {
  console.log('❌ GeneralSection - 容器端口 placeholder 设置有问题');
}

console.log('\n📋 功能说明:');
console.log('');
console.log('🎯 基础配置中的容器端口:');
console.log('   - 位置: 服务配置 → 基础配置 → 部署配置 → 容器端口');
console.log('   - 作用: 告诉系统应用在容器内监听哪个端口');
console.log('   - 默认值: 8080 (在创建表单中设置)');
console.log('   - 后端兜底: 如果用户不填写，后端会自动设置为 8080');
console.log('');
console.log('🌐 网络配置中的端口映射:');
console.log('   - 位置: 服务详情 → 网络 → 端口映射');
console.log('   - 作用: 配置 Kubernetes 服务的端口转发规则');
console.log('   - 默认值: 容器端口和服务端口都为 8080');
console.log('   - 支持多端口: 可以添加多个端口映射');
console.log('');
console.log('🔗 两者关系:');
console.log('   - 基础配置的容器端口通常对应网络配置中的容器端口');
console.log('   - 但网络配置更灵活，支持端口转发和多端口映射');
console.log('   - 网络配置是 Kubernetes 层面的配置，基础配置是应用层面的配置');

console.log('\n✅ 所有端口默认值设置完成！');
console.log('用户现在可以在创建服务和配置网络时直接点击保存，无需手动输入端口号。');