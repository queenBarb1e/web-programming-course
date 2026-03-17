// src/routes/auth.ts
import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { githubCallbackSchema } from '../utils/validation.js'
import type { MiddlewareHandler } from 'hono'

type JwtPayload = {
  userId: string
  email: string
  githubId: string
  iat?: number
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

const auth = new Hono<{ Bindings: { JWT_SECRET: string } }>()

// POST /api/auth/github/callback (mock-режим)
auth.post('/github/callback', async (c) => {
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Неверный формат JSON' }, 400)
  }

  const parsed = githubCallbackSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message || 'Ошибка валидации' },
      400
    )
  }

  const { code } = parsed.data

  if (code.startsWith('test_')) {
    const mockUserData = {
      githubId: '999999999',
      name: 'Тестовый Студент',
      email: 'test.student@lab.ru',
    }

    let user
    try {
      user = await prisma.user.upsert({
        where: { githubId: mockUserData.githubId },
        update: {
          name: mockUserData.name,
          email: mockUserData.email,
        },
        create: {
          githubId: mockUserData.githubId,
          name: mockUserData.name,
          email: mockUserData.email,
        },
      })
    } catch (err) {
      console.error('Ошибка базы:', err)
      return c.json({ error: 'Ошибка базы данных' }, 500)
    }

    const payload = {
      userId: user.id,
      email: user.email,
      githubId: user.githubId,
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return c.json({ error: 'Отсутствует JWT_SECRET в настройках' }, 500)
    }

    const token = await sign(payload, secret)

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        githubId: user.githubId,
      },
    })
  }

  return c.json({ error: 'Реальный GitHub OAuth пока не реализован' }, 501)
})

// Функция проверки JWT (Checkpoint 4)
const requireAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.status(401)
    return c.json({ error: 'Authorization header missing or invalid format (Bearer <token>)' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256') as JwtPayload
    c.set('jwtPayload', payload)
    await next()
  } catch (err) {
    c.status(401)
    return c.json({ error: 'Invalid or expired token' })
  }
}

// GET /api/auth/me — защищённый роут (Checkpoint 4 + начало 5)
auth.get('/me', requireAuth, async (c) => {
  // payload уже проверен в middleware, берём его из контекста
  const payload = c.get('jwtPayload') as JwtPayload

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  if (!user) {
    c.status(404)
    return c.json({ error: 'User not found' })
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      githubId: user.githubId,
      createdAt: user.createdAt.toISOString(),
    },
  })
})

export default auth