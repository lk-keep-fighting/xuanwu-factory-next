/**
 * Final test to verify all Jenkins issues are fixed
 */

const fs = require('fs')

console.log('🔍 Final Jenkins Script Validation...\n')

const scriptPath = 'doc/jenkins/脚本/build-java-jar'
const content = fs.readFileSync(scriptPath, 'utf8')

// Test 1: Check for problematic patterns
console.log('1. Checking for problematic patterns...')
const problematicPatterns = [
  { pattern: /ansiColor\s*\(/, description: 'ansiColor usage' },
  { pattern: /replaceFirst\s*\(\s*'[^']*\$[^']*'\s*,/, description: 'unescaped $ in single quotes' }
]

let issuesFound = 0
problematicPatterns.forEach(({ pattern, description }) => {
  if (pattern.test(content)) {
    console.log(`❌ Found issue: ${description}`)
    issuesFound++
  } else {
    console.log(`✅ No issues with: ${description}`)
  }
})

// Test 2: Check for required elements
console.log('\n2. Checking required pipeline elements...')
const requiredElements = [
  'pipeline {',
  'agent any',
  'options {',
  'timestamps()',
  'parameters {',
  'environment {',
  'NEXUS_RAW_REPO',
  'stages {',
  'stage(\'Checkout\')',
  'stage(\'Build JAR\')',
  'stage(\'Upload JAR to Nexus\')',
  'docker.image',
  'withCredentials',
  'post {',
  'success {',
  'failure {',
  'SendBuildCallback'
]

let missingElements = 0
requiredElements.forEach(element => {
  if (!content.includes(element)) {
    console.log(`❌ Missing: ${element}`)
    missingElements++
  }
})

if (missingElements === 0) {
  console.log('✅ All required elements present')
}

// Test 3: Check for Java JAR specific features
console.log('\n3. Checking Java JAR specific features...')
const javaFeatures = [
  'BUILD_TOOL',
  'JAVA_VERSION',
  'RUNTIME_IMAGE',
  'JAVA_OPTIONS',
  'MAVEN_PROFILES',
  'GRADLE_TASKS',
  'maven:3.9-eclipse-temurin',
  'gradle:8.4-jdk',
  'artifacts/application.jar',
  'build/libs',
  'target'
]

let missingFeatures = 0
javaFeatures.forEach(feature => {
  if (!content.includes(feature)) {
    console.log(`❌ Missing Java feature: ${feature}`)
    missingFeatures++
  }
})

if (missingFeatures === 0) {
  console.log('✅ All Java JAR features present')
}

// Test 4: Check for Docker integration
console.log('\n4. Checking Docker integration...')
const dockerFeatures = [
  'docker.image(',
  '.inside(',
  'curlimages/curl:latest'
]

let missingDockerFeatures = 0
dockerFeatures.forEach(feature => {
  if (!content.includes(feature)) {
    console.log(`❌ Missing Docker feature: ${feature}`)
    missingDockerFeatures++
  }
})

if (missingDockerFeatures === 0) {
  console.log('✅ All Docker features present')
}

// Summary
console.log('\n🎯 Validation Summary:')
console.log(`- Problematic patterns: ${issuesFound === 0 ? '✅ None found' : `❌ ${issuesFound} found`}`)
console.log(`- Required elements: ${missingElements === 0 ? '✅ All present' : `❌ ${missingElements} missing`}`)
console.log(`- Java JAR features: ${missingFeatures === 0 ? '✅ All present' : `❌ ${missingFeatures} missing`}`)
console.log(`- Docker integration: ${missingDockerFeatures === 0 ? '✅ All present' : `❌ ${missingDockerFeatures} missing`}`)

const totalIssues = issuesFound + missingElements + missingFeatures + missingDockerFeatures
if (totalIssues === 0) {
  console.log('\n🎉 All tests passed! Jenkins script is ready for deployment.')
} else {
  console.log(`\n⚠️  Found ${totalIssues} issues that need to be addressed.`)
}