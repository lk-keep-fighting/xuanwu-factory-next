#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { runPrismaGenerate } = require('./run-prisma-generate')

const exitCode = runPrismaGenerate({ allowSkipEnv: true, label: 'manual-prisma-generate' })
process.exit(exitCode)
