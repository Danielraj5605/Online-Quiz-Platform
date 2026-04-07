import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, CheckCircle, Circle, ChevronLeft, ChevronRight, Shuffle, Clock } from 'lucide-react';
import api from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'MULTI_SELECT' | 'FILL_BLANK';

interface Option {
  text: string;
  isCorrect: boolean;
}

interface Question {
  text: string;
  type: QuestionType;
  options: Option[];
}

const CreateQuiz = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timeLimit, setTimeLimit] = useState(600);
  const [maxAttempts, setMaxAttempts] = useState<number | null>(null);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { text: '', type: 'MULTIPLE_CHOICE', options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false }
    ] }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 basics, 1 questions, 2 review

  const addQuestion = (type: QuestionType = 'MULTIPLE_CHOICE') => {
    const newQuestion: Question = { text: '', type, options: [] };
    if (type === 'TRUE_FALSE') {
      newQuestion.options = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false }
      ];
    } else if (type === 'FILL_BLANK') {
      newQuestion.options = [{ text: '', isCorrect: true }];
    } else {
      newQuestion.options = [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false }
      ];
    }
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      setQuestions(newQuestions);
    }
  };

  const addOption = (qIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.push({ text: '', isCorrect: false });
    setQuestions(newQuestions);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    if (questions[qIndex].options.length > 2) {
      const newQuestions = [...questions];
      newQuestions[qIndex].options.splice(oIndex, 1);
      setQuestions(newQuestions);
    }
  };

  const handleOptionChange = (qIndex: number, oIndex: number, field: keyof Option, value: any) => {
    const newQuestions = [...questions];
    const question = newQuestions[qIndex];

    if (field === 'isCorrect' && value === true) {
      if (question.type === 'MULTI_SELECT') {
        // Toggle for multi-select - allow multiple correct
        newQuestions[qIndex].options[oIndex].isCorrect = !newQuestions[qIndex].options[oIndex].isCorrect;
      } else {
        // Ensure only one option is correct
        question.options.forEach((opt, idx) => {
          opt.isCorrect = idx === oIndex;
        });
      }
    } else {
      (newQuestions[qIndex].options[oIndex] as any)[field] = value;
    }
    setQuestions(newQuestions);
  };

  const handleQuestionTypeChange = (qIndex: number, type: QuestionType) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].type = type;

    if (type === 'TRUE_FALSE') {
      newQuestions[qIndex].options = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false }
      ];
    } else if (type === 'FILL_BLANK') {
      newQuestions[qIndex].options = [{ text: '', isCorrect: true }];
    } else if (type === 'MULTI_SELECT') {
      // Keep existing options but mark none as correct initially
      newQuestions[qIndex].options.forEach(opt => opt.isCorrect = false);
    }
    setQuestions(newQuestions);
  };

  const handleQuestionChange = (qIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].text = value;
    setQuestions(newQuestions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      setStep((s) => (s + 1) as any);
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      await api.post('/quiz', {
        title,
        description,
        category,
        difficulty,
        timeLimit,
        maxAttempts: maxAttempts || null,
        shuffleQuestions,
        availableFrom: availableFrom || null,
        availableUntil: availableUntil || null,
        questions: questions.map((q) => ({
          text: q.text,
          type: q.type,
          options: q.options.filter((o) => o.text.trim() !== '')
        }))
      });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create quiz.');
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep((s) => (s === 2 ? 2 : ((s + 1) as 0 | 1 | 2)));
  const prevStep = () => setStep((s) => (s === 0 ? 0 : ((s - 1) as 0 | 1 | 2)));

  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    const copy = [...questions];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    setQuestions(copy);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 text-slate-100">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-blue-300 font-semibold">Builder</p>
            <h1 className="text-3xl font-black text-white">Create a New Quiz</h1>
            <p className="text-slate-300 mt-1">Keep it concise and add clear options. One correct answer per question.</p>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold shadow-md">
            {questions.length} question{questions.length !== 1 && 's'}
          </div>
        </div>
        <div className="mt-4 flex gap-4 items-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                step === i ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/20' :
                step > i ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-500 border border-white/10'
              }`}>
                {step > i ? '✓' : i + 1}
              </div>
              <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-indigo-600' : 'bg-white/5'}`} />
            </div>
          ))}
        </div>
      </Card>
      
      {error && (
        <div className="p-4 text-sm text-red-300 bg-red-900/40 rounded-xl border border-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {step === 0 && (
          <Card>
            <div className="space-y-4">
              <Input
                label="Quiz Title"
                required
                placeholder="e.g., General Knowledge Quiz"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-200">Description</span>
                <textarea
                  className="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Tell us what this quiz is about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="grid sm:grid-cols-3 gap-4">
                <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., General" />
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-200">Difficulty</span>
                  <select
                    className="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <Input
                  label="Time Limit (seconds)"
                  type="number"
                  min={30}
                  max={3600}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                />
              </div>

              {/* Advanced Settings */}
              <div className="pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Advanced Settings
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Max Attempts (empty = unlimited)"
                    type="number"
                    min={1}
                    placeholder="e.g., 3"
                    value={maxAttempts || ''}
                    onChange={(e) => setMaxAttempts(e.target.value ? Number(e.target.value) : null)}
                  />
                  <Input
                    label="Available From (optional)"
                    type="datetime-local"
                    value={availableFrom}
                    onChange={(e) => setAvailableFrom(e.target.value)}
                  />
                  <Input
                    label="Available Until (optional)"
                    type="datetime-local"
                    value={availableUntil}
                    onChange={(e) => setAvailableUntil(e.target.value)}
                  />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShuffleQuestions(!shuffleQuestions)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      shuffleQuestions
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Shuffle className="w-4 h-4" />
                    <span className="text-sm font-semibold">Shuffle Questions</span>
                  </button>
                  <span className="text-xs text-slate-500">Randomize question order for each attempt</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Questions</h2>
              <span className="text-xs font-semibold text-blue-200 bg-blue-900/40 px-3 py-1 rounded-full border border-blue-700">
                {shuffleQuestions ? 'Shuffled' : 'Fixed order'}
              </span>
            </div>
            {questions.map((question, qIndex) => (
              <Card key={qIndex} className="relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500" />
                <div className="absolute top-4 right-4 flex gap-2 text-xs text-slate-400">
                  <button onClick={() => moveQuestion(qIndex, qIndex - 1)} className="hover:text-blue-300">↑</button>
                  <button onClick={() => moveQuestion(qIndex, qIndex + 1)} className="hover:text-blue-300">↓</button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    className="hover:text-red-400"
                    title="Remove Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Question Type Selector */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    <select
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 text-sm"
                      value={question.type}
                      onChange={(e) => handleQuestionTypeChange(qIndex, e.target.value as QuestionType)}
                    >
                      <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="MULTI_SELECT">Multi-Select</option>
                      <option value="FILL_BLANK">Fill in the Blank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1 text-blue-200">Question {qIndex + 1}</label>
                    <Input
                      required
                      placeholder={
                        question.type === 'FILL_BLANK'
                          ? 'Enter question with ___ for blank'
                          : 'Enter your question here'
                      }
                      value={question.text}
                      onChange={(e) => handleQuestionChange(qIndex, e.target.value)}
                    />
                  </div>

                  {question.type === 'FILL_BLANK' ? (
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                      <p className="text-sm text-green-300">
                        Fill in the Blank: Students will type their answer. The first option's text is used as the correct answer.
                      </p>
                      <Input
                        label="Correct Answer"
                        placeholder="Type the correct answer"
                        value={question.options[0]?.text || ''}
                        onChange={(e) => handleOptionChange(qIndex, 0, 'text', e.target.value)}
                        className="mt-2"
                      />
                    </div>
                  ) : question.type === 'TRUE_FALSE' ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold mb-1 text-slate-200">Select the correct answer</label>
                      {question.options.map((option, oIndex) => (
                        <button
                          key={oIndex}
                          type="button"
                          onClick={() => handleOptionChange(qIndex, oIndex, 'isCorrect', true)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                            option.isCorrect
                              ? 'border-green-500 bg-green-500/20 text-green-300'
                              : 'border-slate-700 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          {option.isCorrect ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                          <span className="font-semibold">{option.text}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <label className="block text-sm font-semibold mb-1 text-slate-200">
                          {question.type === 'MULTI_SELECT' ? 'Options (select ALL correct answers)' : 'Options (tap the correct one)'}
                        </label>
                        {question.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-900/40 rounded-xl p-3 border border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleOptionChange(qIndex, oIndex, 'isCorrect', true)}
                              className={`p-2 rounded-full self-start sm:self-auto border ${option.isCorrect ? 'border-green-500 text-green-400 bg-green-900/30' : 'border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-300'}`}
                            >
                              {option.isCorrect ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <input
                              type="text"
                              required
                              className="flex-1 p-3 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-slate-900/60 text-slate-100 text-sm"
                              placeholder={`Option ${oIndex + 1}`}
                              value={option.text}
                              onChange={(e) => handleOptionChange(qIndex, oIndex, 'text', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => removeOption(qIndex, oIndex)}
                              className="text-gray-400 hover:text-red-500 self-start sm:self-auto"
                              title="Remove Option"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {question.options.length < 6 && (
                          <button
                            type="button"
                            onClick={() => addOption(qIndex)}
                            className="flex items-center text-sm font-semibold text-blue-300 hover:text-blue-200"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Option
                          </button>
                        )}
                      </div>
                      {question.type === 'MULTI_SELECT' && (
                        <p className="text-xs text-slate-500 mt-1">
                          Multi-select: Students can select multiple correct answers
                        </p>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => addQuestion('MULTIPLE_CHOICE')} className="border border-blue-500/40 bg-slate-900 text-blue-100">
                <Plus className="w-5 h-5 mr-2" />
                Add Multiple Choice
              </Button>
              <Button type="button" variant="secondary" onClick={() => addQuestion('TRUE_FALSE')} className="border border-blue-500/40 bg-slate-900 text-blue-100">
                <Plus className="w-5 h-5 mr-2" />
                Add True/False
              </Button>
              <Button type="button" variant="secondary" onClick={() => addQuestion('MULTI_SELECT')} className="border border-blue-500/40 bg-slate-900 text-blue-100">
                <Plus className="w-5 h-5 mr-2" />
                Add Multi-Select
              </Button>
              <Button type="button" variant="secondary" onClick={() => addQuestion('FILL_BLANK')} className="border border-blue-500/40 bg-slate-900 text-blue-100">
                <Plus className="w-5 h-5 mr-2" />
                Add Fill Blank
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <Card>
            <h2 className="text-xl font-bold text-white mb-4">Review</h2>
            <div className="space-y-2 text-slate-200">
              <div className="font-semibold">{title}</div>
              <div className="text-slate-400">{description || 'No description'}</div>
              <div className="flex flex-wrap gap-3 text-sm mt-2">
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700">{category || 'Uncategorized'}</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 capitalize">{difficulty}</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700">Time: {timeLimit}s</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700">{questions.length} questions</span>
                {maxAttempts && (
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
                    Max {maxAttempts} attempts
                  </span>
                )}
                {shuffleQuestions && (
                  <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/50 text-indigo-300">
                    Shuffled
                  </span>
                )}
              </div>
              {(availableFrom || availableUntil) && (
                <div className="text-xs text-slate-500 mt-1">
                  Available: {availableFrom ? new Date(availableFrom).toLocaleString() : 'Now'} - {availableUntil ? new Date(availableUntil).toLocaleString() : 'Always'}
                </div>
              )}
            </div>
            <div className="mt-6 space-y-3">
              {questions.map((q, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-slate-100">Q{idx + 1}. {q.text || 'Untitled question'}</div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
                      {q.type.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {q.type === 'FILL_BLANK' ? (
                      <li className="text-green-300 font-semibold">Answer: {q.options[0]?.text || 'Not set'}</li>
                    ) : (
                      q.options.map((o, oi) => (
                        <li key={oi} className={o.isCorrect ? 'text-green-300 font-semibold' : ''}>
                          {o.text || 'Empty option'} {o.isCorrect ? '(correct)' : ''}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          {step > 0 && (
            <Button type="button" variant="secondary" onClick={prevStep} className="sm:w-40">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {step < 2 && (
            <Button type="button" onClick={nextStep} className="sm:w-48">
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          {step === 2 && (
            <Button type="submit" loading={isLoading} className="flex-1">
              {isLoading ? 'Creating Quiz...' : 'Save Quiz'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;
