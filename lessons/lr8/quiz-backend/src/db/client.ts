// src/db/client.ts

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Адаптер для SQLite (обязательно в Prisma 7+)
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

// Теперь PrismaClient с адаптером
const prisma = new PrismaClient({ adapter })

export { prisma }