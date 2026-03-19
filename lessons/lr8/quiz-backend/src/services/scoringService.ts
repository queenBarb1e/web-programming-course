// src/services/scoringService.ts
import { prisma } from '../db/client.js'
// Расширение типов для import.meta.main в ESM
declare global {
  interface ImportMeta {
    main: boolean
  }
}
/**
 * Сервис для подсчёта баллов за ответы в квизе.
 * Это бизнес-логика — сюда выносим все правила подсчёта баллов.
 * Не смешиваем с HTTP-роутами и базой — только чистые вычисления.
 */
export class ScoringService {
  /**
   * Подсчёт баллов за вопрос с множественным выбором.
   * Правила из задания: +1 за каждый правильный ответ,
   * -0.5 за каждый неправильный, итог не меньше 0.
   *
   * Пример:
   * correctAnswers = [0, 2]  (правильные варианты A и C)
   * studentAnswers = [0, 1, 2] → +1 (0) +1 (2) -0.5 (1) = 1.5
   */
  scoreMultipleSelect(correctAnswers: number[], studentAnswers: number[]): number {
    const correctSet = new Set(correctAnswers); // быстрый поиск правильных
    let score = 0;

    for (const answer of studentAnswers) {
      if (correctSet.has(answer)) {
        score += 1;  // правильный → +1
      } else {
        score -= 0.5;  // неправильный → -0.5
      }
    }

    return Math.max(0, score);  // нельзя меньше 0
  }

  /**
   * Подсчёт баллов за эссе (открытый ответ).
   * Пока простая версия: среднее арифметическое оценок проверяющих,
   * но не больше максимума из рубрики.
   *
   * Пример:
   * grades = [8, 9, 7] → среднее 8
   * rubric = { maxPoints: 10 } → результат 8
   */
  scoreEssay(grades: number[], rubric: { maxPoints: number }): number {
    if (grades.length === 0) return 0;

    const sum = grades.reduce((acc, g) => acc + g, 0);
    const average = sum / grades.length;

    return Math.min(average, rubric.maxPoints); // не больше максимума
  }
}

// Один экземпляр сервиса — его будем импортировать и использовать везде
export const scoringService = new ScoringService();

// ────────────────────────────────────────────────
// Временные тесты (запускаются, если запустить файл напрямую)
// После проверки можно удалить
if (import.meta.main) {
  console.log("=== Тесты scoreMultipleSelect ===");

  console.log(
    "Тест 1: правильные [0,2], студент [0,1,2] →",
    scoringService.scoreMultipleSelect([0, 2], [0, 1, 2])
  ); // должно быть 1.5

  console.log(
    "Тест 2: правильные [1], студент [0] →",
    scoringService.scoreMultipleSelect([1], [0])
  ); // должно быть 0

  console.log(
    "Тест 3: правильные [0,1,2], студент [0,1,2] →",
    scoringService.scoreMultipleSelect([0, 1, 2], [0, 1, 2])
  ); // должно быть 3

  console.log(
    "Тест 4: правильные [], студент [1] →",
    scoringService.scoreMultipleSelect([], [1])
  ); // должно быть 0

  console.log(
    "Тест 5: правильные [0], студент [] →",
    scoringService.scoreMultipleSelect([0], [])
  ); // должно быть 0

  console.log("\n=== Тесты scoreEssay (пока простая версия) ===");

  console.log(
    "Тест 1: оценки [8,9,7], max 10 →",
    scoringService.scoreEssay([8, 9, 7], { maxPoints: 10 })
  ); // должно быть 8

  console.log(
    "Тест 2: оценки [5,10,0], max 10 →",
    scoringService.scoreEssay([5, 10, 0], { maxPoints: 10 })
  ); // ~5

  console.log(
    "Тест 3: оценки [12,8], max 10 →",
    scoringService.scoreEssay([12, 8], { maxPoints: 10 })
  ); // 10 (не больше max)

  console.log(
    "Тест 4: пустой массив, max 10 →",
    scoringService.scoreEssay([], { maxPoints: 10 })
  ); // 0
}