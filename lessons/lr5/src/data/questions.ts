import { Question } from '../types/quiz';

export const mockQuestions: Question[] = [
  {
    id: 1,
    question: "Что выведет console.log(typeof null)?",
    options: ["null", "undefined", "object", "number"],
    correctAnswer: 2,
    difficulty: "easy"
  },
  {
    id: 2,
    question: "Какой метод НЕ изменяет исходный массив?",
    options: ["push()", "pop()", "map()", "sort()"],
    correctAnswer: 2,
    difficulty: "medium"
  },
  {
    id: 3,
    question: "Что такое замыкание (closure)?",
    options: [
      "Функция внутри функции",
      "Функция с доступом к внешним переменным",
      "Закрытая функция",
      "Анонимная функция"
    ],
    correctAnswer: 1,
    difficulty: "hard"
  },
  {
    id: 4,
    question: "Чему равно '2' + 2?",
    options: ["'22'", "4", "NaN", "Error"],
    correctAnswer: 0,
    difficulty: "easy"
  },
  {
    id: 5,
    question: "Что выведет console.log([] == ![])?",
    options: ["true", "false", "undefined", "Error"],
    correctAnswer: 0,
    difficulty: "hard"
  }
];
