import { z } from 'zod'

export const githubCallbackSchema = z.object({
  code: z.string().min(1, { message: "Поле 'code' обязательно и не может быть пустым" }),
})
