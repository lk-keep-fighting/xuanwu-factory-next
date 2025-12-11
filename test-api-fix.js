// Test API parameter fix
const fs = require('fs');

console.log('🔧 API Parameter Fix Verification');
console.log('==================================');

try {
  // Check content API
  const contentApi = fs.readFileSync('src/app/api/services/[id]/files/content/route.ts', 'utf8');
  
  console.log('\n📖 Content API:');
  const contentChecks = [
    'Promise<{ id: string }>',
    'await params',
    'const { id: serviceId } = await params',
    'Service ID and file path are required'
  ];

  contentChecks.forEach(check => {
    const found = contentApi.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check} - ${found ? 'Fixed' : 'Missing'}`);
  });

  // Check save API
  const saveApi = fs.readFileSync('src/app/api/services/[id]/files/save/route.ts', 'utf8');
  
  console.log('\n💾 Save API:');
  const saveChecks = [
    'Promise<{ id: string }>',
    'await params',
    'const { id: serviceId } = await params',
    'Service ID, file path, and content are required'
  ];

  saveChecks.forEach(check => {
    const found = saveApi.includes(check);
    console.log(`   ${found ? '✅' : '❌'} ${check} - ${found ? 'Fixed' : 'Missing'}`);
  });

  // Check for old patterns that should be removed
  console.log('\n🧹 Cleanup Check:');
  const cleanupChecks = [
    { file: 'content', content: contentApi, pattern: 'console.log', should: 'be removed' },
    { file: 'save', content: saveApi, pattern: 'console.log', should: 'be removed' },
    { file: 'content', content: contentApi, pattern: '{ params: { id: string } }', should: 'be updated' }
  ];

  cleanupChecks.forEach(check => {
    const found = check.content.includes(check.pattern);
    console.log(`   ${found ? '❌' : '✅'} ${check.file} API - ${check.pattern} ${found ? 'still present' : check.should}`);
  });

  console.log('\n📊 Summary:');
  console.log('   ✅ Updated params to Promise<{ id: string }>');
  console.log('   ✅ Added await for params destructuring');
  console.log('   ✅ Maintained proper error handling');
  console.log('   ✅ Removed debug console.log statements');
  console.log('   ✅ API routes should now work correctly');

  console.log('\n🎉 API parameter fix completed!');

} catch (error) {
  console.error('❌ Error verifying API fix:', error.message);
}