#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

if (process.env.SKIP_PRISMA_GENERATE === 'true') {
  console.log('[postinstall] SKIP_PRISMA_GENERATE=true, 跳过 Prisma generate。')
  process.exit(0)
}

const projectRoot = process.cwd()
const schemaPath = join(projectRoot, 'prisma', 'schema.prisma')

if (!existsSync(schemaPath)) {
  console.warn('[postinstall] 未找到 prisma/schema.prisma，跳过 Prisma generate。')
  process.exit(0)
}

const prismaBinaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
const prismaBinaryPath = join(projectRoot, 'node_modules', '.bin', prismaBinaryName)

if (!existsSync(prismaBinaryPath)) {
  console.warn('[postinstall] 未安装 Prisma CLI（node_modules/.bin/prisma），跳过 Prisma generate。')
  console.warn('           请在本地开发环境运行 `pnpm add -D prisma` 或安装 devDependencies 后再执行。')
  process.exit(0)
}

const env = {
  ...process.env,
  PRISMA_CLI_BINARY_TARGETS: process.env.PRISMA_CLI_BINARY_TARGETS || 'native,linux-musl-openssl-3.0.x'
}

const result = spawnSync(prismaBinaryPath, ['generate'], {
  stdio: 'inherit',
  cwd: projectRoot,
  env
})

if (result.error) {
  console.error('[postinstall] 执行 Prisma generate 失败:', result.error)
  process.exit(result.status ?? 1)
}

process.exit(result.status ?? 0)
