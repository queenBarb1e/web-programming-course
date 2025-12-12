import { observer } from 'mobx-react-lite';
import { gameStore } from '../stores/gameStore';
import { useUIStore } from '../stores/uiStore';
import { useState } from "react";

import { usePostApiSessions } from '../../generated/api/sessions/sessions';
import { usePostApiSessionsSessionIdAnswers } from '../../generated/api/sessions/sessions';
import { usePostApiSessionsSessionIdSubmit } from '../../generated/api/sessions/sessions';

const Task4 = observer(() => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [essayText, setEssayText] = useState("");
  const [serverFinalResult, setServerFinalResult] = useState<any | null>(null);

  const createSession = usePostApiSessions();
  const submitAnswer = usePostApiSessionsSessionIdAnswers();
  const submitSession = usePostApiSessionsSessionIdSubmit();

  const { gameStatus, currentQuestion, selectedAnswers, progress } = gameStore;

  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);

  const bgGradient = theme === 'light'
    ? 'from-purple-500 to-indigo-600'
    : 'from-gray-900 to-black';

  const cardBg = theme === 'light' ? 'bg-white' : 'bg-gray-800';
  const textColor = theme === 'light' ? 'text-gray-800' : 'text-white';
  const mutedText = theme === 'light' ? 'text-gray-600' : 'text-gray-400';
  const primaryColor = theme === 'light' ? 'bg-purple-600' : 'bg-purple-700';
  const primaryHover = theme === 'light' ? 'hover:bg-purple-700' : 'hover:bg-purple-800';

  const handleStartGame = () => {
    createSession.mutate(
      { data: { questionCount: 5, difficulty: "medium" } },
      {
        onSuccess: (data) => {
          setSessionId(data.sessionId);
          setServerFinalResult(null);
          gameStore.setQuestionsFromAPI(data.questions);
          gameStore.startGame();
        }
      }
    );
  };

  const finishSessionOnServer = () => {
    if (!sessionId) {
      gameStore.finishGame();
      return;
    }

    submitSession.mutate(
      { sessionId },
      {
        onSuccess: (resp) => {
          console.log("SESSION_FINAL:", resp);
          setServerFinalResult(resp);
          gameStore.finishGame();
        },
        onError: () => gameStore.finishGame()
      }
    );
  };

  const handleClickNext = () => {
    if (!sessionId || !currentQuestion) return;

    if (currentQuestion.type === "essay" && essayText.trim().length === 0) return;
    if (currentQuestion.type !== "essay" && selectedAnswers.length === 0) return;

    const payload = {
      questionId: currentQuestion.id.toString(),
      selectedOptions: currentQuestion.type === "essay" ? [] : selectedAnswers,
      text: currentQuestion.type === "essay" ? essayText : null
    };

    submitAnswer.mutate(
      { sessionId, data: payload },
      {
        onSuccess: (resp) => {
          console.log("ANSWER_RESPONSE:", resp);

          const answers = resp.answers ?? [];
          const last = answers[answers.length - 1];

          const isCorrect = last?.status === "correct";
          const points = last?.pointsEarned ?? 0;

          gameStore.saveCurrentAnswer();
          gameStore.updateAnswerResult(isCorrect, points);

          const wasLast = gameStore.isLastQuestion;

          gameStore.nextQuestion();
          setEssayText("");

          if (wasLast) finishSessionOnServer();
        },
        onError: () => {
          const wasLast = gameStore.isLastQuestion;

          gameStore.saveCurrentAnswer();
          gameStore.updateAnswerResult(false, 0);

          gameStore.nextQuestion();
          setEssayText("");

          if (wasLast) finishSessionOnServer();
        }
      }
    );
  };

  if (gameStatus === 'idle') {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgGradient} flex items-center justify-center p-4`}>
        <div className={`${cardBg} rounded-2xl shadow-2xl p-8 max-w-md w-full`}>

          <div className="flex justify-end mb-4">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg ${
                theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>

          <h1 className={`text-4xl font-bold mb-2 text-center ${textColor}`}>Quiz Game</h1>

          <button
            onClick={handleStartGame}
            className={`w-full ${primaryColor} ${primaryHover} text-white py-4 px-6 rounded-xl font-semibold`}
          >
            Начать игру
          </button>
        </div>
      </div>
    );
  }

  if (gameStatus === 'finished') {
    const earned = serverFinalResult?.score?.earned ?? 0;
    const percentage = serverFinalResult?.score?.percentage ?? 0;

    const getEmoji = () => {
      if (percentage >= 80) return '🏆';
      if (percentage >= 60) return '😊';
      if (percentage >= 40) return '🤔';
      return '😢';
    };

    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgGradient} flex items-center justify-center p-4`}>
        <div className={`${cardBg} p-8 rounded-2xl shadow-2xl text-center`}>
          <div className="text-6xl mb-4">{getEmoji()}</div>

          <h2 className={`text-3xl font-bold mb-4 ${textColor}`}>Игра завершена!</h2>

          <p className={`text-5xl font-bold ${
            theme === 'light' ? 'text-purple-600' : 'text-purple-400'
          } mb-2`}>
            {earned}
          </p>

          <p className={`${mutedText} mb-4`}>({percentage}%)</p>

          <button
            onClick={() => {
              gameStore.resetGame();
              setServerFinalResult(null);
            }}
            className={`w-full ${primaryColor} ${primaryHover} text-white py-3 rounded-xl font-semibold`}
          >
            Играть снова
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgGradient} p-4`}>
      <div className="max-w-2xl mx-auto">

        <div className={`${cardBg} rounded-lg shadow-md p-4 mb-4`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`${mutedText}`}>
              Вопрос {gameStore.currentQuestionIndex + 1} из {gameStore.questions.length}
            </span>
          </div>

          <div className={`w-full ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'} rounded-full h-2`}>
            <div
              className={`${theme === 'light' ? 'bg-purple-600' : 'bg-purple-500'} h-2 rounded-full`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className={`${cardBg} rounded-2xl shadow-2xl p-6`}>
          <h2 className={`text-2xl font-bold mb-6 ${textColor}`}>
            {currentQuestion.question}
          </h2>

          {currentQuestion.type === "essay" ? (
            <div className="space-y-4">
              <textarea
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                placeholder="Введите развернутый ответ..."
                className={`
                  w-full p-4 rounded-lg border-2 min-h-[150px]
                  ${theme === 'light'
                    ? 'border-gray-300 bg-white text-gray-800'
                    : 'border-gray-600 bg-gray-700 text-white'}
                `}
              />

              <button
                onClick={handleClickNext}
                disabled={essayText.trim().length === 0}
                className={`
                  w-full ${primaryColor} ${primaryHover} text-white py-3 rounded-xl font-semibold
                  ${essayText.trim().length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {gameStore.isLastQuestion ? 'Завершить' : 'Отправить ответ'}
              </button>
            </div>
          ) : (
            <>
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswers.includes(index);

              return (
                <button
                  key={index}
                  onClick={() => gameStore.toggleAnswer(index)}
                  className={`
                    w-full p-4 text-left rounded-lg border-2 transition-all
                    ${!isSelected && (theme === 'light'
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-600 bg-gray-700')}
                    ${isSelected && (theme === 'light'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-purple-500 bg-gray-600')}
                  `}
                >
                  <div className="flex items-center">
                    <span
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center mr-3 font-semibold
                        ${isSelected
                          ? 'bg-purple-600 text-white'
                          : theme === 'light'
                            ? 'bg-gray-200'
                            : 'bg-gray-600 text-white'}
                      `}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>

                    <span className={`flex-1 ${textColor}`}>{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedAnswers.length > 0 && (
            <button
              onClick={handleClickNext}
              className={`mt-6 w-full ${primaryColor} ${primaryHover} text-white py-3 rounded-xl font-semibold`}
           >
              {gameStore.isLastQuestion ? 'Завершить' : 'Следующий вопрос'}
            </button>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default Task4;
