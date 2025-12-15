/**
 * Test script to verify Docker images are using official Docker Hub images
 */

const fs = require('fs')

console.log('🐳 Testing Docker Images Fix...\n')

const scriptPath = 'doc/jenkins/脚本/build-java-jar'
const content = fs.readFileSync(scriptPath, 'utf8')

// Test 1: Check if private registry Docker images are removed (exclude Nexus repo URL)
console.log('1. Checking for private registry Docker images...')
const privateDockerImagePatterns = [
  /nexus\.aimstek\.cn\/aims-common/g,
  /aims-common/g
]

let privateImagesFound = 0
privateDockerImagePatterns.forEach(pattern => {
  const matches = content.match(pattern)
  if (matches) {
    console.log(`❌ Found ${matches.length} references to private Docker images`)
    privateImagesFound += matches.length
  }
})

if (privateImagesFound === 0) {
  console.log('✅ No private Docker image references found')
}

// Note: NEXUS_RAW_REPO for JAR upload is expected and should remain

// Test 2: Check if official Docker Hub images are used
console.log('\n2. Checking for official Docker Hub images...')
const officialImages = [
  'maven:3.9-eclipse-temurin-8',
  'maven:3.9-eclipse-temurin-11', 
  'maven:3.9-eclipse-temurin-17',
  'maven:3.9-eclipse-temurin-21',
  'gradle:8.4-jdk8',
  'gradle:8.4-jdk11',
  'gradle:8.4-jdk17',
  'gradle:8.4-jdk21'
]

let missingOfficialImages = 0
officialImages.forEach(image => {
  if (!content.includes(image)) {
    console.log(`❌ Missing official image: ${image}`)
    missingOfficialImages++
  }
})

if (missingOfficialImages === 0) {
  console.log('✅ All official Docker Hub images present')
}

// Test 3: Check Java version mapping
console.log('\n3. Checking Java version to image mapping...')
const versionMappings = [
  { version: '8', maven: 'maven:3.9-eclipse-temurin-8', gradle: 'gradle:8.4-jdk8' },
  { version: '11', maven: 'maven:3.9-eclipse-temurin-11', gradle: 'gradle:8.4-jdk11' },
  { version: '17', maven: 'maven:3.9-eclipse-temurin-17', gradle: 'gradle:8.4-jdk17' },
  { version: '21', maven: 'maven:3.9-eclipse-temurin-21', gradle: 'gradle:8.4-jdk21' }
]

let mappingIssues = 0
versionMappings.forEach(({ version, maven, gradle }) => {
  const versionBlock = content.match(new RegExp(`case '${version}':[\\s\\S]*?break`, 'g'))
  if (!versionBlock || !versionBlock[0].includes(maven) || !versionBlock[0].includes(gradle)) {
    console.log(`❌ Java ${version} mapping issue`)
    mappingIssues++
  }
})

if (mappingIssues === 0) {
  console.log('✅ All Java version mappings correct')
}

// Test 4: Check default images
console.log('\n4. Checking default images...')
const defaultSection = content.match(/default:[\s\S]*?}/g)
if (defaultSection && 
    defaultSection[0].includes('maven:3.9-eclipse-temurin-17') && 
    defaultSection[0].includes('gradle:8.4-jdk17')) {
  console.log('✅ Default images set to Java 17')
} else {
  console.log('❌ Default images not properly configured')
  mappingIssues++
}

// Test 5: Verify curl image is still official
console.log('\n5. Checking curl image...')
if (content.includes('curlimages/curl:latest')) {
  console.log('✅ Curl image is official')
} else {
  console.log('❌ Curl image missing or incorrect')
  mappingIssues++
}

// Summary
console.log('\n🎯 Docker Images Fix Summary:')
console.log(`- Private registry references: ${privateImagesFound === 0 ? '✅ Removed' : `❌ ${privateImagesFound} found`}`)
console.log(`- Official images: ${missingOfficialImages === 0 ? '✅ All present' : `❌ ${missingOfficialImages} missing`}`)
console.log(`- Version mappings: ${mappingIssues === 0 ? '✅ Correct' : `❌ ${mappingIssues} issues`}`)

const totalIssues = privateImagesFound + missingOfficialImages + mappingIssues
if (totalIssues === 0) {
  console.log('\n🎉 All Docker images successfully updated to official versions!')
  console.log('\n📋 Updated Images:')
  console.log('Maven Images:')
  console.log('  - maven:3.9-eclipse-temurin-8')
  console.log('  - maven:3.9-eclipse-temurin-11')
  console.log('  - maven:3.9-eclipse-temurin-17 (default)')
  console.log('  - maven:3.9-eclipse-temurin-21')
  console.log('Gradle Images:')
  console.log('  - gradle:8.4-jdk8')
  console.log('  - gradle:8.4-jdk11')
  console.log('  - gradle:8.4-jdk17 (default)')
  console.log('  - gradle:8.4-jdk21')
  console.log('Utility Images:')
  console.log('  - curlimages/curl:latest')
} else {
  console.log(`\n⚠️  Found ${totalIssues} issues that need to be addressed.`)
}