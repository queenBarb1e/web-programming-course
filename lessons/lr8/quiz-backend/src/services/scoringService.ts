type EssayRubric = {
  maxPoints: number; // Максимум баллов за весь essay (например, 10)
  criteria: {   // Критерии оценивания
    name: string;  // Название критерия (например, "Грамотность")
    maxPoints: number;  // Максимум за этот критерий (например, 3)
  }[];
};

// МЕТОД 1: multiple-select (множественный выбор)
// Класс с методами подсчёта баллов
export class ScoringService {
  // 1. MULTIPLE-SELECT: +1 за правильный, -0.5 за неправильный, минимум 0
  scoreMultipleSelect(correctAnswers: string[], studentAnswers: string[]): number {
    // Если нет правильных ответов или студент ничего не выбрал — 0 баллов
    if (!correctAnswers.length || !studentAnswers.length) {
      return 0;
    }

    let score = 0;
    
    // Создаем множества для быстрого поиска
    // correctAnswers = ["A", "C", "D"] - correctSet = {"A", "C", "D"}
    const correctSet = new Set(correctAnswers);
    // studentAnswers = ["A", "B"] - studentSet = {"A", "B"}
    const studentSet = new Set(studentAnswers);
    
    // Начисляем за все правильные ответы
    // Проходим по всем ПРАВИЛЬНЫМ ответам
    for (const answer of correctSet) {
      // Если студент выбрал этот вариант — +1
      if (studentSet.has(answer)) {
        score += 1; // "A" есть в обоих - +1
      }
    }
    
    // Отнимаем за лишние (неправильные) варианты
    // Проходим по всем ответам СТУДЕНТА
    for (const answer of studentSet) {
      // Если это НЕ правильный ответ — штраф −0.5
      if (!correctSet.has(answer)) {
        score -= 0.5; // "B" нет в правильных - −0.5
      }
    }
    // После этого цикла: score = 1 − 0.5 = 0.5
    // Не даём уйти в минус (если студент выбрал только неправильные)
    return Math.max(0, score);
  }

  // Подсчет баллов для essay вопросов, посчитать баллы за развернутый ответ, который оценивает админ по кртиреиям
  scoreEssay(grades: number[], rubric: EssayRubric): number {
    // grades = [3, 2, 3] — оценки админа по каждому критерию
    // rubric.criteria.length = 3 — количество критериев

    // Проверка: количество оценок = количеству критериев
    if (grades.length !== rubric.criteria.length) {
      throw new Error('Количество оценок должно соответствовать количеству критериев');
    }

    let totalScore = 0;
    
    // Проходим по всем критериям
    for (let i = 0; i < grades.length; i++) {
      const grade = grades[i]; // оценка за этот критерий (например, 3)
      const maxForCriterion = rubric.criteria[i].maxPoints; // максимум (например, 4)
   
      // Валидация: оценка не больше максимума
      if (grade > maxForCriterion) {
        throw new Error(`Оценка по критерию "${rubric.criteria[i].name}" не может превышать ${maxForCriterion}`);
      }
      
      // Валидация: оценка не отрицательная
      if (grade < 0) {
        throw new Error('Оценка не может быть отрицательной');
      }
      // Прибавляем к общей сумме
      totalScore += grade;
    }
    
    // Не даём превысить максимум всего essay
    return Math.min(totalScore, rubric.maxPoints);
  }
  // идет проверка, что админ выставил столько же оценок сколько и критериев
  // каждая оценка не больше максимума своего критерия
  // оценки не отриц
  // итог не превыш общий максимум

  // универсальный диспетчер - вызывать один метод,  который вызывает нужный подсчет в зависимости от типа вопроса
  scoreQuestion(
    questionType: string,
    correctAnswer: any, // правильный ответ из БД
    studentAnswer: any, // ответ студента
    rubric?: EssayRubric // рубрика (только для essay)
  ): number {
    switch (questionType) {
      case 'multiple-select':
        // Для множественного выбора — вызываем метод выше
        return this.scoreMultipleSelect(correctAnswer, studentAnswer);
      
      case 'single-select':
        // Для одиночного выбора: просто сравниваем строки
        // "A" === "A" → 1 балл, "A" === "B" → 0 баллов
        return correctAnswer === studentAnswer ? 1 : 0;
      
      case 'essay':
        // Для essay нужна рубрика, иначе ошибка
        if (!rubric) {
          throw new Error('Для essay вопросов необходима рубрика оценивания');
        }
        // studentAnswer здесь — это grades (массив оценок)
        return this.scoreEssay(studentAnswer, rubric);
      
      default:
        // Неизвестный тип — ошибка
        throw new Error(`Неподдерживаемый тип вопроса: ${questionType}`);
    }
  }
}

export const scoringService = new ScoringService();