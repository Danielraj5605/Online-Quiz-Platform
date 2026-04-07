import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, CheckCircle2, Square } from 'lucide-react';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ProgressRing } from '../components/ui/ProgressRing';

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'FILL_BLANK';

interface Option {
  id: number;
  text: string;
}

interface Question {
  id: number;
  text: string;
  type: QuestionType;
  options: Option[];
}

interface Quiz {
  id: number;
  title: string;
  questions: Question[];
  timeLimit: number;
}

type Answers = Record<number, number | number[] | string>;

const TakeQuiz = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number>(0);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);

  useEffect(() => {
    const startQuiz = async () => {
      try {
        const response = await api.post(`/quiz/${id}/start`);
        const { quiz, attemptId, startedAt, timeLimit } = response.data;
        setQuiz(quiz);
        setAttemptId(attemptId);
        const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        setRemaining(Math.max(0, timeLimit - elapsed));
      } catch (err) {
        setError('Failed to load quiz.');
      } finally {
        setIsLoading(false);
      }
    };
    startQuiz();
  }, [id]);

  useEffect(() => {
    if (!quiz || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [quiz, remaining]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const elapsedSeconds = quiz ? quiz.timeLimit - remaining : undefined;
      const response = await api.post(`/quiz/${id}/submit`, { answers, attemptId, elapsedSeconds });
      navigate(`/result/${id}`, {
        state: {
          score: response.data.score,
          total: response.data.total,
          xpEarned: response.data.xpEarned,
          newTier: response.data.newTier,
          newBadges: response.data.newBadges,
          attemptId: response.data.attemptId,
        },
      });
    } catch (err) {
      if (!auto) setError('Failed to submit quiz.');
    } finally {
      setIsSubmitting(false);
    }
  }, [id, answers, attemptId, navigate, quiz, remaining, isSubmitting]);

  useEffect(() => {
    if (remaining === 0 && quiz && !isSubmitting) {
      handleSubmit(true);
    }
  }, [remaining, quiz, isSubmitting, handleSubmit]);

  const handleNext = useCallback(() => {
    if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
      setDirection('next');
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev + 1);
        setDirection(null);
      }, 50);
    }
  }, [quiz, currentQuestionIndex]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setDirection('prev');
      setTimeout(() => {
        setCurrentQuestionIndex((prev) => prev - 1);
        setDirection(null);
      }, 50);
    }
  }, [currentQuestionIndex]);

  const handleOptionSelect = (questionId: number, optionId: number, questionType: QuestionType) => {
    if (questionType === 'MULTI_SELECT') {
      // Toggle for multi-select - allow multiple selections
      const current = (answers[questionId] as number[]) || [];
      const isSelected = current.includes(optionId);
      const newAnswers = isSelected
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      setAnswers({ ...answers, [questionId]: newAnswers });
    } else {
      setAnswers({ ...answers, [questionId]: optionId });
    }
  };

  const handleTextAnswer = (questionId: number, text: string) => {
    setAnswers({ ...answers, [questionId]: text });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting || !quiz) return;

      const currentQuestion = quiz.questions[currentQuestionIndex];

      // Skip keyboard shortcuts for FILL_BLANK
      if (currentQuestion.type !== 'FILL_BLANK' && e.key >= '1' && e.key <= '4') {
        const optionIdx = parseInt(e.key) - 1;
        if (currentQuestion.options[optionIdx]) {
          handleOptionSelect(currentQuestion.id, currentQuestion.options[optionIdx].id, currentQuestion.type);
        }
      } else if (currentQuestion.type !== 'FILL_BLANK' && (e.key === 'ArrowRight' || e.key === 'Enter')) {
        const currentAnswer = answers[currentQuestion.id];
        const hasAnswer = currentAnswer !== undefined && (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true);
        if (hasAnswer) {
          if (currentQuestionIndex === quiz.questions.length - 1) {
            handleSubmit();
          } else {
            handleNext();
          }
        }
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quiz, currentQuestionIndex, answers, isSubmitting, handleNext, handlePrevious, handleSubmit]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!quiz) return <div className="p-8 text-center text-red-400">Quiz not found.</div>;

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timePercent = (remaining / quiz.timeLimit) * 100;
  
  const timerColor = timePercent > 50 ? '#10b981' : timePercent > 20 ? '#f59e0b' : '#ef4444';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-100 pb-24">
      {/* Header Card */}
      <Card className="border border-indigo-900/40 bg-indigo-950/10 backdrop-blur-sm sticky top-20 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">Live Session</span>
              <h1 className="text-xl font-black text-white truncate max-w-[200px] sm:max-w-xs">{quiz.title}</h1>
            </div>
            {/* Question Navigator Dots */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quiz.questions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    idx === currentQuestionIndex 
                      ? 'bg-indigo-500 ring-2 ring-indigo-500/30 ring-offset-2 ring-offset-[#0b0f1a] scale-125' 
                      : answers[quiz.questions[idx].id] 
                        ? 'bg-indigo-500/60' 
                        : 'bg-white/10 hover:bg-white/20'
                  }`}
                  title={`Question ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 self-end sm:self-auto">
            {/* Circular Timer */}
            <div className="relative flex items-center justify-center">
              <ProgressRing 
                value={timePercent} 
                size={56} 
                stroke={4} 
                color={timerColor} 
                trackColor="rgba(255,255,255,0.05)" 
              />
              <div className="absolute inset-0 flex items-center justify-center flex-col leading-none">
                <span className="text-xs font-bold text-white">{minutes}:{seconds.toString().padStart(2, '0')}</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-400">Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              </div>
              <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Question Card */}
      <div className={`transition-all duration-300 ${direction === 'next' ? 'animate-slide-out-left' : direction === 'prev' ? 'animate-slide-in-right' : 'animate-pop-in'}`}>
        <Card className="border border-white/10 bg-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
          
          <div className="flex items-start gap-4 mb-8">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-black grid place-items-center text-xl shadow-inner">
              {currentQuestionIndex + 1}
            </div>
            <h2 className="text-2xl font-bold leading-tight text-white pt-1">{currentQuestion.text}</h2>
          </div>

          <div className="grid gap-3">
            {currentQuestion.type === 'FILL_BLANK' ? (
              <div className="p-4 rounded-2xl border-2 border-white/10 bg-white/5">
                <input
                  type="text"
                  className="w-full p-4 bg-transparent text-lg text-white placeholder-slate-400 focus:outline-none"
                  placeholder="Type your answer here..."
                  value={(answers[currentQuestion.id] as string) || ''}
                  onChange={(e) => handleTextAnswer(currentQuestion.id, e.target.value)}
                />
              </div>
            ) : (
              currentQuestion.options.map((option, idx) => {
                const currentAnswer = answers[currentQuestion.id];
                let isSelected = false;
                if (currentQuestion.type === 'MULTI_SELECT') {
                  isSelected = (currentAnswer as number[] || []).includes(option.id);
                } else {
                  isSelected = currentAnswer === option.id;
                }
                const hasSelection = currentAnswer !== undefined && (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : true);

                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionSelect(currentQuestion.id, option.id, currentQuestion.type)}
                    className={`group relative w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 transform active:scale-[0.99] ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/50'
                        : hasSelection
                          ? 'border-white/5 bg-white/2 hover:border-white/20 opacity-60'
                          : 'border-white/10 bg-white/5 hover:border-indigo-500/50 hover:bg-white/[0.07]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 shrink-0 rounded-xl border-2 flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-500 text-white rotate-[360deg]'
                          : 'border-white/10 text-slate-400'
                      }`}>
                        {currentQuestion.type === 'MULTI_SELECT' ? (
                          isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Square className="w-5 h-5" />
                        ) : (
                          String.fromCharCode(65 + idx)
                        )}
                      </div>
                      <span className={`text-lg font-medium transition-colors ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {option.text}
                      </span>
                      {isSelected && (
                        <div className="ml-auto animate-pop-in">
                          <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-8 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {currentQuestion.type === 'MULTI_SELECT' ? (
              <span>Select all correct answers</span>
            ) : currentQuestion.type === 'FILL_BLANK' ? (
              <span>Type your answer</span>
            ) : (
              <span>Keyboard shortcuts: 1-4 to select</span>
            )}
            {!isLastQuestion && currentQuestion.type !== 'FILL_BLANK' && <span>Enter to continue</span>}
          </div>
        </Card>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4">
        <Button
          type="button"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          variant="ghost"
          className="px-6 py-6 border border-white/5 bg-white/2 hover:bg-white/10"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </Button>
        
        {isLastQuestion ? (
          <Button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting || answers[currentQuestion.id] === undefined || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as number[]).length === 0)}
            className="sm:min-w-[200px] py-6 shadow-xl shadow-indigo-600/20"
            loading={isSubmitting}
          >
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Finish & Submit
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={
              answers[currentQuestion.id] === undefined ||
              (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as number[]).length === 0)
            }
            className="sm:min-w-[180px] py-6 shadow-xl shadow-indigo-600/20"
          >
            Next Question
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default TakeQuiz;
