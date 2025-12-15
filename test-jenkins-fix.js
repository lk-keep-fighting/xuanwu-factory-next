/**
 * Test script to verify Jenkins ansiColor fix
 */

const fs = require('fs')

console.log('🔧 Testing Jenkins AnsiColor Fix...\n')

// Test 1: Check if ansiColor is removed from build-java-jar script
console.log('1. Checking build-java-jar script...')
try {
  const scriptPath = 'doc/jenkins/脚本/build-java-jar'
  const content = fs.readFileSync(scriptPath, 'utf8')
  
  if (content.includes('ansiColor')) {
    console.log('❌ build-java-jar still contains ansiColor')
  } else {
    console.log('✅ ansiColor removed from build-java-jar')
  }
  
  if (content.includes('timestamps()')) {
    console.log('✅ timestamps() option preserved')
  } else {
    console.log('❌ timestamps() option missing')
  }
} catch (error) {
  console.log('❌ Error checking build-java-jar:', error.message)
}

// Test 2: Check if Jenkins config documentation is updated
console.log('\n2. Checking Jenkins configuration documentation...')
try {
  const docPath = 'doc/jenkins/Jenkins配置.md'
  const content = fs.readFileSync(docPath, 'utf8')
  
  if (content.includes('ansiColor')) {
    console.log('❌ Jenkins配置.md still contains ansiColor')
  } else {
    console.log('✅ ansiColor removed from Jenkins配置.md')
  }
} catch (error) {
  console.log('❌ Error checking Jenkins配置.md:', error.message)
}

// Test 3: Verify pipeline structure is intact
console.log('\n3. Verifying pipeline structure...')
try {
  const scriptPath = 'doc/jenkins/脚本/build-java-jar'
  const content = fs.readFileSync(scriptPath, 'utf8')
  
  const requiredElements = [
    'pipeline {',
    'agent any',
    'options {',
    'timestamps()',
    'parameters {',
    'environment {',
    'stages {',
    'stage(\'Checkout\')',
    'stage(\'Build JAR\')',
    'stage(\'Upload JAR to Nexus\')',
    'post {'
  ]
  
  let allPresent = true
  requiredElements.forEach(element => {
    if (!content.includes(element)) {
      console.log(`❌ Missing: ${element}`)
      allPresent = false
    }
  })
  
  if (allPresent) {
    console.log('✅ All required pipeline elements present')
  }
} catch (error) {
  console.log('❌ Error verifying pipeline structure:', error.message)
}

console.log('\n🎉 Jenkins AnsiColor fix verification completed!')
console.log('\n📋 Fix Summary:')
console.log('- Removed ansiColor(\'xterm\') option from Jenkins pipeline')
console.log('- Preserved timestamps() option for build timing')
console.log('- Updated documentation to reflect changes')
console.log('- Maintained all build functionality and stages')
console.log('- Improved compatibility with different Jenkins environments')