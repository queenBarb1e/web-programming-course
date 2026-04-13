import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { PrismaClient } from '@prisma/client'
import { sessionService } from '../services/sessionService.js'
import { startSessionSchema, answerSchema } from '../utils/validation.js'

const prisma = new PrismaClient()
const sessions = new Hono()

// POST /api/sessions
sessions.post('/', zValidator('json', startSessionSchema), async (c) => {
  try {
    const { userId } = c.req.valid('json')

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return c.json({ error: 'Пользователь не найден' }, 404)
    }

    const questionsCount = await prisma.question.count()
    if (questionsCount === 0) {
      return c.json({ error: 'Нет доступных вопросов' }, 400)
    }

    const session = await prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      },
      include: { user: true }
    })

    return c.json({ session }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

// POST /api/sessions/:id/answers
sessions.post('/:id/answers', zValidator('json', answerSchema), async (c) => {
  try {
    const sessionId = c.req.param('id')
    const { questionId, userAnswer } = c.req.valid('json') 

    const answer = await sessionService.submitAnswer({
      sessionId,
      questionId,
      userAnswer
    })

    return c.json({ answer }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return c.json({ error: message }, 400)
  }
})

sessions.get('/:id', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const userId = c.req.header('X-User-Id')

    if (!userId) {
      return c.json({ error: 'Не авторизован' }, 401)
    }

    const session = await sessionService.getSessionWithAnswers(sessionId, userId)
    return c.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return c.json({ error: message }, 400)
  }
})

sessions.post('/:id/submit', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const session = await sessionService.submitSession(sessionId)
    return c.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return c.json({ error: message }, 400)
  }
})

export default sessions