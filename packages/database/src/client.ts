import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '../generated/prisma/client.js'

const envPaths = [
  resolve(process.cwd(), 'packages/database/.env'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../packages/database/.env'),
]

for (const path of envPaths) {
  if (existsSync(path)) config({ path })
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
