#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

/**
 * 统一的 Prisma generate 执行器。
 * @param {{ allowSkipEnv?: boolean; label?: string }} [options]
 * @returns {number} exit code
 */
function runPrismaGenerate(options = {}) {
  const { allowSkipEnv = false, label = 'prisma-generate' } = options

  if (allowSkipEnv && process.env.SKIP_PRISMA_GENERATE === 'true') {
    console.log(`[${label}] SKIP_PRISMA_GENERATE=true，跳过 Prisma generate。`)
    return 0
  }

  const projectRoot = process.cwd()
  const schemaPath = join(projectRoot, 'prisma', 'schema.prisma')

  if (!existsSync(schemaPath)) {
    console.warn(`[${label}] 未找到 prisma/schema.prisma，跳过 Prisma generate。`)
    return 0
  }

  const prismaBinaryName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
  const prismaBinaryPath = join(projectRoot, 'node_modules', '.bin', prismaBinaryName)

  if (!existsSync(prismaBinaryPath)) {
    console.warn(`[${label}] 未安装 Prisma CLI（node_modules/.bin/prisma），跳过 Prisma generate。`)
    console.warn(`[${label}] 如果需要，请先安装 devDependencies 或设置 SKIP_PRISMA_GENERATE=true。`)
    return 0
  }

  const defaultBinaryTargets = process.env.PRISMA_CLI_BINARY_TARGETS ||
    'debian-openssl-3.0.x,linux-musl-openssl-3.0.x'

  const env = {
    ...process.env,
    PRISMA_CLI_BINARY_TARGETS: defaultBinaryTargets
  }

  console.log(`[${label}] 执行 prisma generate ...`)
  const result = spawnSync(prismaBinaryPath, ['generate'], {
    stdio: 'inherit',
    cwd: projectRoot,
    env
  })

  if (result.error) {
    console.error(`[${label}] 执行 Prisma generate 失败:`, result.error)
    return result.status ?? 1
  }

  return result.status ?? 0
}

module.exports = { runPrismaGenerate }
