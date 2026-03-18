// Подключаем Hono — это наш мини-фреймворк для создания API
import { Hono } from 'hono'
// Подключаем функции для работы с JWT-токенами: sign — создать токен, verify — проверить токен
import { sign, verify } from 'hono/jwt'
// Prisma — это как удобный способ общаться с базой данных без SQL
import { PrismaClient } from '@prisma/client'
// Адаптер для SQLite в Prisma 7+ (иначе Prisma ругается)
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
// схема проверки из предыдущего файла (чтобы убедиться, что в запросе есть code)
import { githubCallbackSchema } from '../utils/validation.js'
// Тип для middleware (нужен, чтобы TypeScript не ругался на c и next)
import type { MiddlewareHandler } from 'hono'

// Тип данных, которые лежат в JWT-токене (чтобы TypeScript знал, что там есть userId)
type JwtPayload = {
  userId: string
  email: string
  githubId: string
  iat?: number // время выдачи токена
}

// Создаём адаптер для базы SQLite
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db', // путь к файлу базы из .env
})

// Создаём клиент Prisma — это наш "мостик" к базе данных
const prisma = new PrismaClient({ adapter })
// Создаём группу роутов (все пути будут начинаться с /api/auth)
const auth = new Hono<{ Bindings: { JWT_SECRET: string } }>()

// POST /api/auth/github/callback — обработка "входа через GitHub" (пока mock-режим)
auth.post('/github/callback', async (c) => {
  // 1. Читаем тело запроса (то, что прислали в JSON)
  let body
  try {
    body = await c.req.json() // пытаемся разобрать JSON
  } catch {
    // Если JSON битый — возвращаем ошибку
    return c.json({ error: 'Неверный формат JSON' }, 400)
  }

 // 2. Проверяем по схеме Zod (из validation.ts)
  const parsed = githubCallbackSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      // Если проверка не прошла — возвращаем понятную ошибку
      { error: parsed.error.issues[0]?.message || 'Ошибка валидации' },
      400
    )
  }

// 3. Достаём code из запроса
  const { code } = parsed.data
  // 4. Mock-режим (то, что требует задание — если code начинается с test_)
  if (code.startsWith('test_')) {
    // Фейковые данные пользователя, как будто пришли от GitHub
    const mockUserData = {
      githubId: '1111111',
      name: 'Сладкова Екатерина',
      email: 'sladkovakate@mail.ru',
    }
    // Сохраняем или обновляем пользователя в базе (upsert — умная команда)
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


    // 5. Готовим данные для токена (что положим внутрь JWT)
    const payload = {
      userId: user.id,
      email: user.email,
      githubId: user.githubId,
    }

    // 6. Проверяем, что секретный ключ есть
    const secret = process.env.JWT_SECRET
    if (!secret) {
      return c.json({ error: 'Отсутствует JWT_SECRET в настройках' }, 500)
    }
    // 7. Создаём токен
    const token = await sign(payload, secret)

    // 8. Возвращаем ответ, как просит задание
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
  // Если не mock — говорим, что пока не умеем
  return c.json({ error: 'Реальный GitHub OAuth пока не реализован' }, 501)
})

// Функция защиты: проверяет токен перед доступом к /me
const requireAuth: MiddlewareHandler = async (c, next) => {
  // Смотрим заголовок Authorization
  const authHeader = c.req.header('Authorization')

  // Если нет или не начинается с Bearer — ошибка
  //Bearer — это схема аутентификации HTTP, которая включает использование токенов безопасности — токенов Bearer. Название можно понимать как «предоставить доступ обладателю этого токена»
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    c.status(401)
    return c.json({ error: 'Authorization header missing or invalid format (Bearer <token>)' })
  }
  // Достаём сам токен после слова Bearer
  const token = authHeader.split(' ')[1]

  try {
    // Проверяем токен (3 аргумента, как в задании)
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256') as JwtPayload
    // Если ок — сохраняем данные из токена для дальнейшего использования
    c.set('jwtPayload', payload)
    await next() // всё хорошо — идём дальше
  } catch (err) {
    // Если токен плохой — ошибка 401
    c.status(401)
    return c.json({ error: 'Invalid or expired token' })
  }
}

// GET /api/auth/me — получаем данные текущего пользователя (Checkpoint 4 + начало 5)
auth.get('/me', requireAuth, async (c) => {
  // Достаём данные из токена (уже проверено middleware)
  const payload = c.get('jwtPayload') as JwtPayload
  // Ищем пользователя в базе по id из токена
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })
  // Если не нашли — 404
  if (!user) {
    c.status(404)
    return c.json({ error: 'User not found' })
  }
  // Возвращаем данные пользователя
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