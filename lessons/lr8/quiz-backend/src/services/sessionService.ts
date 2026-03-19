// src/services/sessionService.ts

import { prisma } from '../db/client.js'        // общий клиент Prisma
import { scoringService } from './scoringService.js'  // калькулятор баллов из Checkpoint 1

/**
 * Сервис для управления сессиями квиза.
 * Здесь вся логика создания сессий, ответов и завершения.
 * Роуты только вызывают методы сервиса — вся умная работа здесь.
 */
export class SessionService {
  constructor() {
    // Prisma уже глобальный из db/client, не нужно передавать
  }

  /**
   * Создать новую сессию (студент начинает квиз).
   * @param userId ID пользователя из таблицы User
   * @returns созданная сессия с id, статусом и временем окончания
   */
  async createSession(userId: string) {
    // 1. Проверяем, что пользователь существует
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('Пользователь не найден')
    }

    // 2. Сессия длится 1 час (60 минут = 3600 секунд = 3600000 мс)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // 3. Создаём сессию в базе
    const session = await prisma.session.create({
      data: {
        userId,                    // кто начал квиз
        status: 'in_progress',     // началась, ещё не завершена
        expiresAt,                 // когда истечёт время
        score: null,               // баллы пока неизвестны
      },
    })

    return session // возвращаем созданную сессию
  }

  /**
   * Студент отвечает на вопрос в сессии.
   * Если вопрос автопроверяемый — сразу считаем баллы через scoringService.
   * @param sessionId ID сессии
   * @param questionId ID вопроса
   * @param userAnswer ответ студента (строка для essay или массив номеров для выбора)
   * @returns созданный ответ с баллами (если посчитали)
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    userAnswer: any // Json — строка или массив
  ) {
    // 1. Находим сессию и проверяем статус
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { answers: true }, // чтобы проверить, отвечал ли уже
    })

    if (!session) {
      throw new Error('Сессия не найдена')
    }

    if (session.status !== 'in_progress') {
      throw new Error('Сессия уже завершена или истекла')
    }

    // 2. Находим вопрос
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    })

    if (!question) {
      throw new Error('Вопрос не найден')
    }

    // 3. Проверяем, не отвечал ли уже на этот вопрос в этой сессии
    const existingAnswer = session.answers.find(a => a.questionId === questionId)
    if (existingAnswer) {
      throw new Error('На этот вопрос уже был дан ответ в сессии')
    }

    let score: number | null = null
    let isCorrect: boolean | null = null

    // 4. Автопроверка для multiple-select / single-select
    if (question.type !== 'essay') {
      // correctAnswer хранится как Json — преобразуем в массив чисел
      const correctAnswers = (question.correctAnswer as number[]) || []

      // userAnswer тоже приводим к массиву (если single-select — будет [число])
      const studentAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer]

      score = scoringService.scoreMultipleSelect(correctAnswers, studentAnswers)

      // isCorrect — полностью верно, если набрал максимум баллов
      isCorrect = score === question.points
    }

    // 5. Создаём ответ в базе
    const answer = await prisma.answer.create({
      data: {
        sessionId,
        questionId,
        userAnswer: JSON.stringify(userAnswer), // сохраняем как JSON-строку
        score,
        isCorrect,
      },
    })

    return answer
  }

  /**
   * Завершить сессию — посчитать итоговый балл и обновить статус.
   * Используем транзакцию, чтобы всё было атомарно.
   * @param sessionId ID сессии
   * @returns обновлённая сессия
   */
  async submitSession(sessionId: string) {
    // Пока заглушка — реализуем позже
    return null
  }
}

// Один экземпляр сервиса — импортируем и используем в роутах
export const sessionService = new SessionService()

// ────────────────────────────────────────────────
// Временный тест метода createSession
if (import.meta.main) {
  console.log("\n=== Тест createSession ===")

  const testUserId = 'cmmxm4fd90000wkuneibclwr8' // твой реальный ID

  try {
    const session = await sessionService.createSession(testUserId)
    console.log("Создана сессия:", session)
  } catch (error: any) {
    console.log("Ошибка:", error.message)
  }
}