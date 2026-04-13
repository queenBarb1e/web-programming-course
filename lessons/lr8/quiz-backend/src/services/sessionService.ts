// src/services/sessionService.ts
// сервис для управления сессиями тестирований, он отвечает за сохранение ответов, подсчет баллов, заверш сес, получ данных сес.
import { PrismaClient } from '@prisma/client'
import { scoringService } from './scoringService.js'

// Создаём клиент для этого модуля
const prisma = new PrismaClient()

//Интерфейс входных данных для submitAnswer
export interface SubmitAnswerInput {
  sessionId: string // ID сессии (какой тест проходит студент)
  questionId: string // ID вопроса
  userAnswer: any // Ответ студента (любой формат: строка, массив, число)
}

// управление жизненным циклом сессии тестирования , в общем отвечает за сохранение ответов, завершение сессии, получение данных сессии
export class SessionService {
  //сохранение ответа студента
  // Проверяет можно ли отвечать - считает баллы - сохраняет ответ.
  async submitAnswer(data: SubmitAnswerInput) {
    return await prisma.$transaction(async (tx) => {
      // Ищем сессию по ID, сразу подтягиваем данные пользователя
      const session = await tx.session.findUnique({
        where: { id: data.sessionId },
        include: { user: true } // include = подтянуть связанные данные
      })

      if (!session) {
        throw new Error('Сессия не найдена') // нет такой сессии - ошибка 
        // throw прерывает транзакцию, изменения не применятся
      }
      // Проверяем статус: можно отвечать только в активной сессии
      if (session.status !== 'in_progress') {
        throw new Error('Сессия уже завершена или истекла')
      }
      // ШАГ 1 Проверяем, не истёк ли срок (1 час с момента создания), Нельзя отвечать в завершённой или просроченной сессии.
      if (session.expiresAt < new Date()) {
        // Автоматически меняем статус на "expired"
        await tx.session.update({
          where: { id: data.sessionId },
          data: { status: 'expired' }
        })
        throw new Error('Время сессии истекло')
      }

      // ШАГ 2 проверяем вопрос
      const question = await tx.question.findUnique({
        where: { id: data.questionId }
      })

      if (!question) {
        throw new Error('Вопрос не найден')
      }

      // ШАГ 3 Проверяем, не отвечали ли уже
      // Один студент = один ответ на один вопрос в одной сессии
      // Ищем по составному уникальному ключу [sessionId + questionId]
      const existingAnswer = await tx.answer.findUnique({
        where: {
          sessionId_questionId: { // @@unique в схеме Prisma
            sessionId: data.sessionId,
            questionId: data.questionId
          }
        }
      })

      if (existingAnswer) {
        throw new Error('Ответ на этот вопрос уже был отправлен')
      }

      // ШАГ 4 Вычисляем баллы (для автоматически проверяемых типов)
      // Логика: автопроверка только для multiple-select
      // Для essay score = null (проверит админ позже)
      let score: number | null = null
      let isCorrect: boolean | null = null
      // Только multiple-select можно проверить автоматически
      if (question.type === 'multiple-select') {
        score = scoringService.scoreQuestion(
          'multiple-select',
          question.correctAnswer ? JSON.parse(question.correctAnswer) : [],
          data.userAnswer
        )
        isCorrect = score > 0 // если балл > 0 → правильно
      }
      // Для essay score остается null до проверки админом

      // 5. Сохраняем ответ
      const answer = await tx.answer.create({
        data: {
          sessionId: data.sessionId,
          questionId: data.questionId,
          userAnswer: JSON.stringify(data.userAnswer), //превращаем ответ в строку для БД
          score, // число или null
          isCorrect // true/false/null
        }
      })

      return answer // возвращаем созданный ответ
    })
  }

  // Завершение сессии
  // студент нажал завешить тест - считаем итоговый балл - меняем статус
  async submitSession(sessionId: string) {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { 
          answers: {
            include: { question: true } // подтягиваем вопросы для каждого ответа
          } 
        }
      })

      if (!session) {
        throw new Error('Сессия не найдена')
      }

      if (session.status !== 'in_progress') {
        throw new Error('Сессия уже завершена или истекла')
      }

      // Вычисляем общий балл (только по автоматически проверенным ответам)
      const totalScore = session.answers.reduce((sum, answer) => { // reduce = "свернуть" массив в одно число
        return sum + (answer.score || 0) // если score null → считаем как 0
      }, 0) // 0 = начальное значение sum

      // Обновляем сессию
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: 'completed', // статус "завершено"
          score: totalScore, // итоговый балл
          completedAt: new Date() // время завершения
        }
      })

      return updatedSession
    })
  }

  // получение данных сессии, загружает сессию со всеми ответами, но только для владельца
  async getSessionWithAnswers(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    // Используем select вместо include для контроля полей
    select: { // выбираем ТОЛЬКО нужные поля, не всё подряд
      id: true,
      status: true,
      score: true,
      startedAt: true,
      expiresAt: true,
      completedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true // только нужные поля пользователя
        }
      },
      answers: {
        select: {
          id: true,
          userAnswer: true,
          score: true,
          isCorrect: true,
          createdAt: true,
          question: {
            select: {
              id: true,
              text: true,
              type: true,
              points: true,
              category: {
                select: {
                  name: true // только имя категории
                }
              }
            }
          }
        }
      }
    }
  })
  // Проверяем: это сессия запрашивающего пользователя?
  if (!session) throw new Error('Сессия не найдена')
  if (session.user.id !== userId) throw new Error('Нет доступа к этой сессии')
  // чужую сессию не видим
  return session
}
}

export const sessionService = new SessionService()