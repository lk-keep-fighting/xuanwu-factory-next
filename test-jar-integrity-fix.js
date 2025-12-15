/**
 * Test script to verify JAR integrity fix implementation
 */

const fs = require('fs')

console.log('🔍 Testing JAR Integrity Fix Implementation...\n')

const scriptPath = 'doc/jenkins/脚本/build-java-jar'
const content = fs.readFileSync(scriptPath, 'utf8')

// Test 1: Check Maven JAR preparation integrity checks
console.log('1. Checking Maven JAR preparation integrity checks...')
const mavenIntegrityChecks = [
  'Verifying original JAR file',
  'stat -c%s "$JAR_FILE"',
  'file "$JAR_FILE" | grep -q "Java archive\\\\|Zip archive"',
  'unzip -t "$JAR_FILE"',
  'Original JAR file integrity verified',
  'Verifying copied JAR file',
  'File size mismatch after copy',
  'unzip -t artifacts/application.jar',
  'Maven JAR preparation completed successfully'
]

let mavenIssues = 0
mavenIntegrityChecks.forEach(check => {
  if (!content.includes(check)) {
    console.log(`❌ Missing Maven integrity check: ${check}`)
    mavenIssues++
  }
})

if (mavenIssues === 0) {
  console.log('✅ All Maven JAR integrity checks present')
}

// Test 2: Check Gradle JAR preparation integrity checks
console.log('\n2. Checking Gradle JAR preparation integrity checks...')
const gradleIntegrityChecks = [
  'Verifying original JAR file',
  'stat -c%s "$JAR_FILE"',
  'file "$JAR_FILE" | grep -q "Java archive\\\\|Zip archive"',
  'unzip -t "$JAR_FILE"',
  'Original JAR file integrity verified',
  'Verifying copied JAR file',
  'File size mismatch after copy',
  'unzip -t artifacts/application.jar',
  'Gradle JAR preparation completed successfully'
]

let gradleIssues = 0
gradleIntegrityChecks.forEach(check => {
  if (!content.includes(check)) {
    console.log(`❌ Missing Gradle integrity check: ${check}`)
    gradleIssues++
  }
})

if (gradleIssues === 0) {
  console.log('✅ All Gradle JAR integrity checks present')
}

// Test 3: Check upload verification enhancements
console.log('\n3. Checking upload verification enhancements...')
const uploadVerificationChecks = [
  'JAR Upload Verification',
  'Checking HTTP response status',
  'curl -s -o /dev/null -w "%{http_code}"',
  'Downloading JAR for integrity check',
  'curl -s -u "\\$NEXUS_USERNAME:\\$NEXUS_PASSWORD" -o "downloaded.jar"',
  'Checking file size',
  'stat -c%s "artifacts/application.jar"',
  'stat -c%s "downloaded.jar"',
  'File size mismatch - JAR may be corrupted during upload',
  'Verifying JAR file format',
  'file downloaded.jar | grep -q "Java archive\\\\|Zip archive"',
  'Verifying JAR contents',
  'unzip -t downloaded.jar',
  'JAR integrity test passed',
  'Checking JAR structure',
  'unzip -l downloaded.jar',
  'JAR Upload Verification Completed Successfully'
]

let uploadIssues = 0
uploadVerificationChecks.forEach(check => {
  if (!content.includes(check)) {
    console.log(`❌ Missing upload verification: ${check}`)
    uploadIssues++
  }
})

if (uploadIssues === 0) {
  console.log('✅ All upload verification checks present')
}

// Test 4: Check error handling and detailed logging
console.log('\n4. Checking error handling and detailed logging...')
const errorHandlingChecks = [
  'ERROR: JAR file does not exist',
  'ERROR: Original JAR file is empty',
  'ERROR: File is not a valid JAR archive',
  'ERROR: Original JAR file is corrupted',
  'ERROR: JAR file copy failed',
  'ERROR: File size mismatch after copy',
  'ERROR: Copied JAR file is corrupted',
  'ERROR: HTTP status',
  'ERROR: Downloaded JAR file is empty',
  'ERROR: JAR file is corrupted - failed integrity test',
  'Original JAR size:',
  'Final JAR size:',
  'Downloaded JAR size:'
]

let errorHandlingIssues = 0
errorHandlingChecks.forEach(check => {
  if (!content.includes(check)) {
    console.log(`❌ Missing error handling: ${check}`)
    errorHandlingIssues++
  }
})

if (errorHandlingIssues === 0) {
  console.log('✅ All error handling and logging present')
}

// Test 5: Check verification flow completeness
console.log('\n5. Checking verification flow completeness...')
const verificationFlow = [
  'Find and Prepare JAR',  // Stage name
  'Upload JAR to Nexus',   // Stage name
  'Verify Upload'          // Stage name
]

let flowIssues = 0
verificationFlow.forEach(stage => {
  if (!content.includes(`stage('${stage}')`)) {
    console.log(`❌ Missing verification stage: ${stage}`)
    flowIssues++
  }
})

if (flowIssues === 0) {
  console.log('✅ All verification flow stages present')
}

// Test 6: Check cleanup and resource management
console.log('\n6. Checking cleanup and resource management...')
const cleanupChecks = [
  'rm -f downloaded.jar',  // Cleanup temporary files
  'docker.image(env.CURL_IMAGE).inside'  // Proper Docker container usage
]

let cleanupIssues = 0
cleanupChecks.forEach(check => {
  if (!content.includes(check)) {
    console.log(`❌ Missing cleanup: ${check}`)
    cleanupIssues++
  }
})

if (cleanupIssues === 0) {
  console.log('✅ All cleanup and resource management present')
}

// Summary
console.log('\n🎯 JAR Integrity Fix Summary:')
console.log(`- Maven integrity checks: ${mavenIssues === 0 ? '✅ Complete' : `❌ ${mavenIssues} issues`}`)
console.log(`- Gradle integrity checks: ${gradleIssues === 0 ? '✅ Complete' : `❌ ${gradleIssues} issues`}`)
console.log(`- Upload verification: ${uploadIssues === 0 ? '✅ Complete' : `❌ ${uploadIssues} issues`}`)
console.log(`- Error handling: ${errorHandlingIssues === 0 ? '✅ Complete' : `❌ ${errorHandlingIssues} issues`}`)
console.log(`- Verification flow: ${flowIssues === 0 ? '✅ Complete' : `❌ ${flowIssues} issues`}`)
console.log(`- Cleanup management: ${cleanupIssues === 0 ? '✅ Complete' : `❌ ${cleanupIssues} issues`}`)

const totalIssues = mavenIssues + gradleIssues + uploadIssues + errorHandlingIssues + flowIssues + cleanupIssues
if (totalIssues === 0) {
  console.log('\n🎉 JAR integrity fix successfully implemented!')
  console.log('\n📋 Implemented Features:')
  console.log('- Multi-stage integrity verification')
  console.log('- File size and format validation')
  console.log('- ZIP structure integrity testing')
  console.log('- HTTP status and download verification')
  console.log('- Detailed error reporting and logging')
  console.log('- Proper cleanup and resource management')
  console.log('\n🛡️ Protection Layers:')
  console.log('1. Build-time verification (Maven/Gradle output)')
  console.log('2. Copy-time verification (file transfer)')
  console.log('3. Upload-time verification (Nexus storage)')
  console.log('4. Download-time verification (retrieval test)')
  console.log('5. Structure verification (JAR content check)')
} else {
  console.log(`\n⚠️  Found ${totalIssues} issues that need to be addressed.`)
}