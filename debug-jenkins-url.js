/**
 * 调试Jenkins URL构建
 * 验证Job路径是否正确
 */

console.log('=== Jenkins URL构建调试 ===')

// 模拟normalizeJobPath函数
function normalizeJobPath(jobName) {
  return jobName
    .split('/')
    .filter(Boolean)
    .map((segment) => `job/${encodeURIComponent(segment)}`)
    .join('/')
}

// 测试不同的Job名称
const testCases = [
  'CICD-STD/build-template',
  'CICD-STD/build-java-jar',
  'CICD-STD/build-frontend',
  'simple-job'
]

console.log('1. Job路径转换测试:')
testCases.forEach(jobName => {
  const normalized = normalizeJobPath(jobName)
  console.log(`   ${jobName} → ${normalized}`)
})

// 模拟完整URL构建
const baseUrl = 'http://192.168.44.121'
const jobName = 'CICD-STD/build-template'
const jobPath = normalizeJobPath(jobName)
const endpoint = `${baseUrl}/${jobPath}/buildWithParameters`

console.log('\n2. 完整URL构建:')
console.log(`   Base URL: ${baseUrl}`)
console.log(`   Job Name: ${jobName}`)
console.log(`   Job Path: ${jobPath}`)
console.log(`   Endpoint: ${endpoint}`)

// 对比实际的Jenkins URL
const actualUrl = 'http://192.168.44.121/view/%E5%B7%A5%E4%B8%9A%E6%93%8D%E4%BD%9C%E7%B3%BB%E7%BB%9F/job/CICD-STD/job/build-template/'
const expectedUrl = 'http://192.168.44.121/job/CICD-STD/job/build-template/buildWithParameters'

console.log('\n3. URL对比:')
console.log(`   实际Job页面: ${actualUrl}`)
console.log(`   期望构建URL: ${expectedUrl}`)

// 分析差异
console.log('\n4. 差异分析:')
console.log('   ✅ 基础域名相同: 192.168.44.121')
console.log('   ✅ Job路径相同: job/CICD-STD/job/build-template')
console.log('   ❓ 实际URL包含view路径，但这不影响API调用')
console.log('   ❓ 可能的问题:')
console.log('      - Job配置不完整')
console.log('      - 缺少必要的参数')
console.log('      - 权限问题')
console.log('      - Jenkins版本兼容性')

// 检查可能的问题
console.log('\n5. 可能的问题和解决方案:')
console.log('   🔍 问题1: Job未配置为参数化构建')
console.log('      解决: 在Job配置中勾选"This project is parameterized"')
console.log('')
console.log('   🔍 问题2: 缺少必要的构建参数')
console.log('      解决: 添加所有必需的参数 (SERVICE_ID, GIT_REPOSITORY等)')
console.log('')
console.log('   🔍 问题3: Jenkins API权限问题')
console.log('      解决: 检查API Token权限，确保可以触发构建')
console.log('')
console.log('   🔍 问题4: Job脚本配置问题')
console.log('      解决: 检查Pipeline脚本是否正确配置')

// 建议的验证步骤
console.log('\n6. 建议的验证步骤:')
console.log('   1️⃣ 在Jenkins中手动触发一次构建')
console.log('   2️⃣ 检查Job是否配置为参数化构建')
console.log('   3️⃣ 验证所有必需参数是否已添加')
console.log('   4️⃣ 检查Pipeline脚本是否正确')
console.log('   5️⃣ 测试API Token权限')

console.log('\n=== 调试完成 ===')
console.log('💡 建议先在Jenkins中手动测试Job是否正常工作')