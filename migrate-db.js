#!/usr/bin/env node

/**
 * Supabase 数据库迁移脚本
 * 为 services 表添加 network_config 字段
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// 读取环境变量
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🚀 开始执行数据库迁移...\n')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误：未找到 Supabase 配置')
  console.error('\n请确保 .env.local 文件包含：')
  console.error('  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co')
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key')
  console.error('  或 SUPABASE_SERVICE_KEY=your-service-key')
  process.exit(1)
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// 读取迁移 SQL 文件
const migrationPath = path.join(__dirname, 'supabase-add-network-config.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

// 将 SQL 分割成多个语句
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

async function runMigration() {
  console.log('📝 执行迁移文件: supabase-add-network-config.sql\n')
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    console.log(`⚙️  执行语句 ${i + 1}/${statements.length}...`)
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
      
      if (error) {
        console.error(`❌ 语句 ${i + 1} 执行失败:`, error.message)
        console.log('\n💡 建议手动执行迁移：')
        console.log('  1. 登录 Supabase Dashboard')
        console.log('  2. 进入 SQL Editor')
        console.log('  3. 复制 supabase-add-network-config.sql 的内容')
        console.log('  4. 粘贴并执行')
        process.exit(1)
      }
      
      console.log(`✅ 语句 ${i + 1} 执行成功`)
    } catch (err) {
      console.error(`❌ 执行出错:`, err.message)
      process.exit(1)
    }
  }
  
  console.log('\n✨ 迁移完成！')
  console.log('📋 services 表现在包含 network_config 字段')
}

// 提供手动迁移说明
console.log('⚠️  注意：Supabase 客户端可能没有权限执行 DDL 语句\n')
console.log('如果自动迁移失败，请手动执行以下步骤：\n')
console.log('📋 手动迁移步骤：')
console.log('  1. 登录 Supabase Dashboard: https://app.supabase.com')
console.log('  2. 选择你的项目')
console.log('  3. 进入 SQL Editor')
console.log('  4. 复制以下 SQL 内容：\n')
console.log('─'.repeat(60))
console.log(migrationSQL)
console.log('─'.repeat(60))
console.log('\n按回车键继续尝试自动迁移，或按 Ctrl+C 取消...')

// 等待用户确认
process.stdin.once('data', async () => {
  try {
    await runMigration()
    process.exit(0)
  } catch (err) {
    console.error('❌ 迁移失败:', err)
    process.exit(1)
  }
})
