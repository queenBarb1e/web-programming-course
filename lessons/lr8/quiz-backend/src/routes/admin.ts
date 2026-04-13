import { Hono } from 'hono' // веб-фреймворк
import { zValidator } from '@hono/zod-validator' // валидация через Zod
import { PrismaClient } from '@prisma/client' // middleware проверки админа
import { requireAdmin } from '../middleware/admin.js'
import { questionSchema, gradeSchema } from '../utils/validation.js' // схемы валидации
import { scoringService } from '../services/scoringService.js' // подсчёт баллов

const prisma = new PrismaClient()
const admin = new Hono()

// Все admin endpoints требуют аутентификации и admin роли, Проверяет Authorization: Bearer <token> заголовок, Проверяет user.role === 'admin'
admin.use('*', requireAdmin)
//  Это "wildcard" — применяется ко всем роутам

// GET /api/admin/questions - получить все вопросы
admin.get('/questions', async (c) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        category: true, // подтягиваем категорию
        _count: {
          select: { answers: true } // считаем количество ответов
        }
      }
    })

    return c.json({ questions })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

// POST /api/admin/questions - создать вопрос
admin.post('/questions', zValidator('json', questionSchema), async (c) => {
  try {
    const data = c.req.valid('json')
    
    // Для multiple-select вопросов проверяем correctAnswer
    if (data.type === 'multiple-select') {
      if (!data.correctAnswer) {
        return c.json({ 
          error: 'Для multiple-select вопросов нужно указать correctAnswer' 
        }, 400)
      }
      
      // Проверяем, что correctAnswer - массив
      if (!Array.isArray(data.correctAnswer)) {
        return c.json({ 
          error: 'correctAnswer должен быть массивом строк' 
        }, 400)
      }
    }
    // создание вопроса
    const question = await prisma.question.create({
      data: {
        text: data.text,
        type: data.type,
        categoryId: data.categoryId,
        correctAnswer: data.correctAnswer ? JSON.stringify(data.correctAnswer) : null,
        points: data.points
      },
      include: {
        category: true
      }
    })

    return c.json({ question }, 201)
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

// POST /api/admin/questions/batch - создать несколько вопросов
admin.post('/questions/batch', async (c) => {
  try {
    const { questions } = await c.req.json()
    
    const result = await prisma.question.createMany({
      data: questions.map((q: any) => ({
        text: q.text,
        type: q.type,
        categoryId: q.categoryId,
        correctAnswer: q.correctAnswer ? JSON.stringify(q.correctAnswer) : null,
        points: q.points || 1
      })),
    })

    return c.json({ count: result.count })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

// PUT /api/admin/questions/:id - обновить вопрос
admin.put('/questions/:id', zValidator('json', questionSchema), async (c) => {
  try {
    const id = c.req.param('id')
    const data = c.req.valid('json')

    const question = await prisma.question.update({
      where: { id },
      data: {
        text: data.text,
        type: data.type,
        categoryId: data.categoryId,
        correctAnswer: data.correctAnswer ? JSON.stringify(data.correctAnswer) : null,
        points: data.points
      },
      include: {
        category: true
      }
    })

    return c.json({ question })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

// GET /api/admin/answers/pending - получить непроверенные essay ответы
admin.get('/answers/pending', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const skip = (page - 1) * limit

    const answers = await prisma.answer.findMany({
      where: {
        question: {
          type: 'essay'
        },
        score: null // непроверенные
      },
      include: {
        session: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        question: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      skip,
      take: limit
    })

    const total = await prisma.answer.count({
      where: {
        question: { type: 'essay' },
        score: null
      }
    })

    return c.json({
      answers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

// POST /api/admin/answers/:id/grade - оценить essay
admin.post('/answers/:id/grade', zValidator('json', gradeSchema), async (c) => {
  try {
    const answerId = c.req.param('id')
    const { grades, rubric } = c.req.valid('json')

    // Используем транзакцию
    const result = await prisma.$transaction(async (tx) => {
      // Получаем ответ
      const answer = await tx.answer.findUnique({
        where: { id: answerId },
        include: {
          question: true,
          session: {
            include: {
              answers: true
            }
          }
        }
      })

      if (!answer) {
        throw new Error('Ответ не найден')
      }

      if (answer.question.type !== 'essay') {
        throw new Error('Можно оценивать только essay вопросы')
      }

      if (answer.score !== null) {
        throw new Error('Ответ уже оценен')
      }

      // Вычисляем баллы
      const score = scoringService.scoreEssay(grades, rubric)

      // Обновляем ответ
      const updatedAnswer = await tx.answer.update({
        where: { id: answerId },
        data: { score },
        include: {
          question: true,
          session: {
            include: {
              user: true
            }
          }
        }
      })

      // Проверяем, все ли ответы в сессии оценены
      const sessionAnswers = await tx.answer.findMany({
        where: {
          sessionId: answer.sessionId
        },
        include: {
          question: true
        }
      })

      const allGraded = sessionAnswers.every(a => 
        a.question.type !== 'essay' || a.score !== null
      )

      // Если все оценены, обновляем общий балл сессии
      if (allGraded) {
        const totalScore = sessionAnswers.reduce((sum, a) => sum + (a.score || 0), 0)
        
        await tx.session.update({
          where: { id: answer.sessionId },
          data: { score: totalScore }
        })
      }

      return updatedAnswer
    })

    return c.json({ answer: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return c.json({ error: message }, 400)
  }
})

// GET /api/admin/students/:userId/stats - статистика студента
admin.get('/students/:userId/stats', async (c) => {
  try {
    const userId = c.req.param('userId')

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sessions: {
          where: {
            status: 'completed'
          },
          include: {
            answers: true
          }
        }
      }
    })

    if (!user) {
      return c.json({ error: 'Пользователь не найден' }, 404)
    }

    const completedSessions = user.sessions.length
    const totalScore = user.sessions.reduce((sum, s) => sum + (s.score || 0), 0)
    const averageScore = completedSessions > 0 ? totalScore / completedSessions : 0

    // Количество ответов по типам вопросов
    const answersByType = await prisma.answer.groupBy({
      by: ['questionId'],
      where: {
        session: {
          userId
        }
      },
      _count: true
    })

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      stats: {
        completedSessions,
        totalScore,
        averageScore,
        totalAnswers: user.sessions.reduce((sum, s) => sum + s.answers.length, 0)
      }
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Внутренняя ошибка сервера' }, 500)
  }
})

export default admin