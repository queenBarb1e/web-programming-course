import { z } from 'zod'

export const githubCallbackSchema = z.object({
  code: z.string().min(1, "Code is required")
})

export type GithubCallbackInput = z.infer<typeof githubCallbackSchema>

export const startSessionSchema = z.object({
  userId: z.string().cuid('Некорректный формат userId (должен быть cuid)')
})

export const answerSchema = z.object({
  questionId: z.string().cuid('Некорректный формат questionId (должен быть cuid)'),
  userAnswer: z.union([
    z.array(z.string()), // для multiple-select
    z.array(z.number()), // для essay (оценки)
    z.string(),
    z.number()
  ])
})

export const gradeSchema = z.object({
  grades: z.array(z.number().min(0)).min(1, 'Нужно указать хотя бы одну оценку'),
  rubric: z.object({
    maxPoints: z.number().positive('Максимальный балл должен быть положительным'),
    criteria: z.array(z.object({
      name: z.string().min(1, 'Название критерия обязательно'),
      maxPoints: z.number().positive('Максимальный балл критерия должен быть положительным')
    })).min(1, 'Нужен хотя бы один критерий')
  })
})

export const questionSchema = z.object({
  text: z.string().min(5, 'Текст вопроса должен быть минимум 5 символов'),
  type: z.enum(['multiple-select', 'essay']),
  categoryId: z.string().cuid('Некорректный categoryId'),
  correctAnswer: z.any().optional(),
  points: z.number().int().positive().default(1)
})

// Типы для использования в коде
export type StartSessionInput = z.infer<typeof startSessionSchema>
export type AnswerInput = z.infer<typeof answerSchema>
export type GradeInput = z.infer<typeof gradeSchema>
export type QuestionInput = z.infer<typeof questionSchema>