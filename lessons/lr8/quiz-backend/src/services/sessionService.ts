// src/services/sessionService.ts

import { prisma } from '../db/client.js'        // общий клиент Prisma
import { scoringService } from './scoringService.js'  // наш калькулятор баллов

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

    return session // возвращаем созданную сессию (с id и другими полями)
  }

  /**
   * Студент отвечает на вопрос в сессии.
   * Если вопрос автопроверяемый — сразу считаем баллы.
   * @param sessionId ID сессии
   * @param questionId ID вопроса
   * @param userAnswer ответ студента (строка или массив)
   * @returns созданный ответ с баллами (если посчитали)
   */
  async submitAnswer(
    sessionId: string,
    questionId: string,
    userAnswer: any // Json — может быть строка или массив
  ) {
    // Пока заглушка — реализуем в следующем шаге
    return null
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

  const testUserId = 'cmmxm4fd90000wkuneibclwr8' // твой реальный ID из базы

  try {
    const session = await sessionService.createSession(testUserId)
    console.log("Создана сессия:", session)
  } catch (error: any) {
    console.log("Ошибка:", error.message)
  }
}