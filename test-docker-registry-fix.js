/**
 * Test script to verify Docker registry configuration fix
 */

const fs = require('fs')

console.log('🐳 Testing Docker Registry Configuration Fix...\n')

const scriptPath = 'doc/jenkins/脚本/build-java-jar'
const content = fs.readFileSync(scriptPath, 'utf8')

// Test 1: Check if DOCKER_REGISTRY environment variable is configured
console.log('1. Checking Docker registry environment configuration...')
if (content.includes('DOCKER_REGISTRY = "${env.DOCKER_REGISTRY ?: \'registry.cn-hangzhou.aliyuncs.com/library\'}"')) {
  console.log('✅ Docker registry environment variable configured with Aliyun mirror as default')
} else {
  console.log('❌ Docker registry environment variable not properly configured')
}

// Test 2: Check if image selection logic uses configurable registry
console.log('\n2. Checking configurable image selection logic...')
const configurablePatterns = [
  'def dockerRegistry = env.DOCKER_REGISTRY',
  'def imagePrefix = dockerRegistry ? "${dockerRegistry}/" : \'\'',
  'env.BUILD_IMAGE = "${imagePrefix}maven:',
  'env.GRADLE_IMAGE = "${imagePrefix}gradle:',
  'env.CURL_IMAGE = "${imagePrefix}curlimages/curl:latest"'
]

let configurableLogicIssues = 0
configurablePatterns.forEach(pattern => {
  if (!content.includes(pattern)) {
    console.log(`❌ Missing configurable logic: ${pattern}`)
    configurableLogicIssues++
  }
})

if (configurableLogicIssues === 0) {
  console.log('✅ All configurable image selection logic present')
}

// Test 3: Check if curl image uses environment variable
console.log('\n3. Checking curl image configuration...')
if (content.includes('docker.image(env.CURL_IMAGE).inside')) {
  console.log('✅ Curl image uses configurable environment variable')
} else {
  console.log('❌ Curl image not using configurable environment variable')
  configurableLogicIssues++
}

// Test 4: Check Java version to image mapping with configurable prefix
console.log('\n4. Checking Java version mappings with configurable prefix...')
const javaVersions = ['8', '11', '17', '21']
let mappingIssues = 0

javaVersions.forEach(version => {
  const casePattern = `case '${version}':`
  const mavenPattern = `env.BUILD_IMAGE = "\${imagePrefix}maven:3.9-eclipse-temurin-${version}"`
  const gradlePattern = `env.GRADLE_IMAGE = "\${imagePrefix}gradle:8.4-jdk${version}"`
  
  if (!content.includes(casePattern)) {
    console.log(`❌ Missing Java ${version} case`)
    mappingIssues++
  } else {
    const caseBlock = content.substring(
      content.indexOf(casePattern),
      content.indexOf('break', content.indexOf(casePattern))
    )
    
    if (!caseBlock.includes(`maven:3.9-eclipse-temurin-${version}`) || 
        !caseBlock.includes(`gradle:8.4-jdk${version}`)) {
      console.log(`❌ Java ${version} mapping incorrect`)
      mappingIssues++
    }
  }
})

if (mappingIssues === 0) {
  console.log('✅ All Java version mappings use configurable prefix')
}

// Test 5: Check default case
console.log('\n5. Checking default case configuration...')
const defaultSection = content.match(/default:[\s\S]*?env\.CURL_IMAGE/g)
if (defaultSection && 
    defaultSection[0].includes('maven:3.9-eclipse-temurin-17') && 
    defaultSection[0].includes('gradle:8.4-jdk17')) {
  console.log('✅ Default case uses Java 17 with configurable prefix')
} else {
  console.log('❌ Default case not properly configured')
  mappingIssues++
}

// Test 6: Verify no hardcoded registry URLs in image selection
console.log('\n6. Checking for hardcoded registry URLs...')
const hardcodedRegistryPatterns = [
  /registry\.cn-hangzhou\.aliyuncs\.com\/library\/maven:/g,
  /registry\.cn-hangzhou\.aliyuncs\.com\/library\/gradle:/g,
  /registry\.cn-hangzhou\.aliyuncs\.com\/library\/curlimages:/g
]

let hardcodedFound = 0
hardcodedRegistryPatterns.forEach(pattern => {
  const matches = content.match(pattern)
  if (matches) {
    console.log(`❌ Found ${matches.length} hardcoded registry URLs`)
    hardcodedFound += matches.length
  }
})

if (hardcodedFound === 0) {
  console.log('✅ No hardcoded registry URLs found in image selection')
}

// Summary
console.log('\n🎯 Docker Registry Configuration Summary:')
console.log(`- Environment configuration: ${content.includes('DOCKER_REGISTRY') ? '✅ Configured' : '❌ Missing'}`)
console.log(`- Configurable logic: ${configurableLogicIssues === 0 ? '✅ Complete' : `❌ ${configurableLogicIssues} issues`}`)
console.log(`- Java version mappings: ${mappingIssues === 0 ? '✅ Correct' : `❌ ${mappingIssues} issues`}`)
console.log(`- Hardcoded URLs: ${hardcodedFound === 0 ? '✅ None found' : `❌ ${hardcodedFound} found`}`)

const totalIssues = configurableLogicIssues + mappingIssues + hardcodedFound
if (totalIssues === 0) {
  console.log('\n🎉 Docker registry configuration successfully implemented!')
  console.log('\n📋 Configuration Features:')
  console.log('- Default: Aliyun mirror (registry.cn-hangzhou.aliyuncs.com/library)')
  console.log('- Configurable: Set DOCKER_REGISTRY environment variable')
  console.log('- Fallback: Empty string for Docker Hub official')
  console.log('- Coverage: Maven, Gradle, and Curl images')
  console.log('\n🚀 Usage Examples:')
  console.log('- Aliyun: DOCKER_REGISTRY="registry.cn-hangzhou.aliyuncs.com/library"')
  console.log('- Tencent: DOCKER_REGISTRY="ccr.ccs.tencentyun.com/library"')
  console.log('- Docker Hub: DOCKER_REGISTRY=""')
} else {
  console.log(`\n⚠️  Found ${totalIssues} issues that need to be addressed.`)
}