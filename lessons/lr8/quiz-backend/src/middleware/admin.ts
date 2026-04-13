import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function requireAdmin(c: Context, next: Next) {
  try {
    // Получаем токен из заголовка
    const authHeader = c.req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      }, 401)
    }

    const token = authHeader.split(' ')[1]
    const secret = process.env.JWT_SECRET || 'dev-secret-key'
    
    // Верифицируем токен
    const payload = await verify(token, secret, 'HS256')
    
    // Проверяем, есть ли пользователь в базе
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string }
    })

    if (!user) {
      return c.json({ 
        success: false,
        error: 'User not found'
      }, 404)
    }

    // Проверяем роль admin
    if (user.role !== 'admin') {
      return c.json({ 
        success: false,
        error: 'Forbidden',
        message: 'Admin access required'
      }, 403)
    }

    // Сохраняем пользователя в контекст для дальнейшего использования
    c.set('user', user)
    await next()
    
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Unauthorized',
      message: 'Invalid token'
    }, 401)
  }
}