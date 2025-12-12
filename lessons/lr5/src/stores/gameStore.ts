import { makeAutoObservable } from 'mobx';
import type { Question, Answer } from '../types/quiz';
import type { QuestionPreview } from "../../generated/api/quizBattleAPI.schemas";

class GameStore {
  gameStatus: 'idle' | 'playing' | 'finished' = 'idle';

  questions: QuestionPreview[] = [];
  currentQuestionIndex = 0;
  score = 0;

  selectedAnswers: number[] = [];
  answeredQuestions: Answer[] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  toggleAnswer(index: number) {
    if (this.gameStatus !== "playing") return;

    this.selectedAnswers = this.selectedAnswers.includes(index)
      ? this.selectedAnswers.filter((i) => i !== index)
      : [...this.selectedAnswers, index].sort((a, b) => a - b);
  }

  saveCurrentAnswer() {
    const q = this.currentQuestion;
    if (!q) return;

    this.answeredQuestions.push({
      questionId: q.id,
      selectedAnswers: [...this.selectedAnswers],
      isCorrect: false,
      points: 0
    });
  }

  resetSelectedAnswers() {
    this.selectedAnswers = [];
  }

  setQuestionsFromAPI(questions: QuestionPreview[]) {
    this.questions = questions;
    this.currentQuestionIndex = 0;
    this.selectedAnswers = [];
    this.answeredQuestions = [];
    this.score = 0;
  }

  updateAnswerResult(isCorrect: boolean, points: number = 0) {
    const last = this.answeredQuestions[this.answeredQuestions.length - 1];
    if (!last) return;

    last.isCorrect = isCorrect;
    last.points = points;

    this.score += points;
  }

  startGame() {
    this.gameStatus = 'playing';
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.selectedAnswers = [];
    } else {
      this.finishGame();
    }
  }

  finishGame() {
    this.gameStatus = 'finished';
  }

  resetGame() {
    this.gameStatus = 'idle';
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.selectedAnswers = [];
    this.answeredQuestions = [];
    this.questions = [];
  }

  get currentQuestion(): Question | null {
    const q = this.questions[this.currentQuestionIndex];
    if (!q) return null;

    return {
      id: q.id,
      type: (q as any).type ?? "choice",
      question: (q as any).question ?? (q as any).text ?? "",
      options: q.options ?? [],
      correctAnswer: -1,
      difficulty: (q as any).difficulty ?? "easy"
    };
  }

  get progress(): number {
    if (this.questions.length === 0) return 0;
    return Math.round(
      ((this.currentQuestionIndex + 1) / this.questions.length) * 100
    );
  }

  get isLastQuestion(): boolean {
    return this.currentQuestionIndex === this.questions.length - 1;
  }

  get correctAnswersCount(): number {
    return this.answeredQuestions.filter(a => a.isCorrect).length;
  }
}

export const gameStore = new GameStore();
