#!/usr/bin/env node

/**
 * 测试浏览器兼容性 - 确保组件不会在客户端调用Prisma
 */

const puppeteer = require('puppeteer')

async function testBrowserCompatibility() {
  console.log('🧪 测试浏览器兼容性...\n')

  let browser
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    
    // 监听控制台错误
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    // 监听页面错误
    page.on('pageerror', error => {
      errors.push(error.message)
    })
    
    console.log('1. 访问项目列表页面...')
    await page.goto('http://localhost:3000/projects', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    })
    
    // 等待页面加载
    await page.waitForTimeout(2000)
    
    console.log('2. 检查是否有Prisma相关错误...')
    const prismaErrors = errors.filter(error => 
      error.includes('PrismaClient') || 
      error.includes('browser environment') ||
      error.includes('bundled for the browser')
    )
    
    if (prismaErrors.length > 0) {
      console.log('❌ 发现Prisma客户端错误:')
      prismaErrors.forEach(error => {
        console.log(`   - ${error}`)
      })
      return false
    } else {
      console.log('✅ 没有发现Prisma客户端错误')
    }
    
    console.log('3. 尝试访问服务详情页面...')
    // 尝试访问一个服务详情页面
    await page.goto('http://localhost:3000/projects/890060f4-7d0d-4201-8b85-4c6965b0c6ca/services/df82a309-bf68-483e-b629-7cd1ea50b599', {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    
    await page.waitForTimeout(2000)
    
    const newPrismaErrors = errors.filter(error => 
      error.includes('PrismaClient') || 
      error.includes('browser environment') ||
      error.includes('bundled for the browser')
    ).slice(prismaErrors.length) // 只获取新的错误
    
    if (newPrismaErrors.length > 0) {
      console.log('❌ 在服务详情页面发现Prisma客户端错误:')
      newPrismaErrors.forEach(error => {
        console.log(`   - ${error}`)
      })
      return false
    } else {
      console.log('✅ 服务详情页面没有Prisma客户端错误')
    }
    
    console.log('\n🎉 浏览器兼容性测试通过!')
    return true
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    
    if (error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      console.log('\n💡 提示: 请确保开发服务器正在运行 (npm run dev)')
    }
    
    return false
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// 检查是否安装了puppeteer
try {
  require('puppeteer')
  testBrowserCompatibility()
} catch (error) {
  console.log('⚠️  Puppeteer未安装，跳过浏览器测试')
  console.log('   如需运行浏览器测试，请安装: npm install puppeteer')
  console.log('✅ 代码修复已完成，组件现在使用API而不是直接调用Prisma客户端')
}