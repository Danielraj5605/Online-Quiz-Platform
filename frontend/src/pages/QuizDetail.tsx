import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Clock, User, BookOpen } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';

interface QuizDetailType {
  id: number;
  title: string;
  description?: string;
  category?: string;
  difficulty?: string;
  timeLimit: number;
  creator: { username: string };
  questions: { id: number }[];
}

const QuizDetail = () => {
  const { id } = useParams();
  const [quiz, setQuiz] = useState<QuizDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/quiz/${id}`);
        setQuiz(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!quiz) return <div className="p-8 text-center text-red-400">Quiz not found</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 text-slate-100">
      <Card className="border border-blue-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-blue-200 uppercase tracking-wide">Quiz overview</p>
          <Badge tone="muted">{quiz.difficulty || 'medium'}</Badge>
        </div>
        <h1 className="text-3xl font-black text-white">{quiz.title}</h1>
        <p className="text-slate-300">{quiz.description || 'No description provided.'}</p>

        <div className="flex flex-wrap gap-3 text-sm text-slate-200">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <BookOpen className="w-4 h-4 text-blue-300" />
            {quiz.questions.length} questions
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <Clock className="w-4 h-4 text-amber-400" />
            {quiz.timeLimit}s time limit
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800">
            <User className="w-4 h-4 text-slate-300" />
            {quiz.creator.username}
          </span>
          {quiz.category && (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-900/40 text-blue-100 border border-blue-800">
              {quiz.category}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Link
            to={`/quiz/${quiz.id}`}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:shadow-lg text-center"
          >
            Start quiz
          </Link>
          <Link
            to={`/quiz/${quiz.id}/leaderboard`}
            className="px-6 py-3 rounded-xl border border-slate-800 text-slate-100 font-semibold bg-slate-900 hover:bg-slate-800 text-center"
          >
            View leaderboard
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default QuizDetail;
