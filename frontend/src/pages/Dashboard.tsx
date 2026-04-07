import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Play, Clock, PlusCircle, Search, BookOpen, Target, Zap } from 'lucide-react';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { Badge } from '../components/ui/Badge';

interface Quiz {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  creator: { username: string };
  createdAt: string;
  _count: { questions: number; results: number };
}

const Dashboard = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ totalAttempts: number; averagePercent: number; totalScore: number } | null>(null);
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          api.get('/quiz'),
          api.get('/user/stats'),
        ]);
        setQuizzes(qRes.data);
        setStats(sRes.data);
      } catch (err) {
        setError('Failed to load quizzes.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(quizzes.map((q) => q.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      const matchesSearch = q.title.toLowerCase().includes(search.toLowerCase()) || 
                           q.description?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || q.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [quizzes, search, selectedCategory]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-4">
        <Skeleton className="h-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Skeleton key={n} className="h-64" />
          ))}
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Section */}
      <Card className="relative overflow-hidden border border-indigo-900/40 bg-indigo-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(108,92,231,0.15),transparent_50%)]" />
        <div className="relative p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <Badge tone="primary" className="mb-4">Nebula v2.0</Badge>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Master your knowledge <br/> with <span className="text-indigo-400">Quizzo</span>
            </h1>
            <p className="text-slate-400 text-lg mt-4 max-w-lg">
              Explore thousands of community-crafted quizzes or challenge your friends with your own creations.
            </p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link 
                to="/create-quiz" 
                className="inline-flex items-center justify-center bg-indigo-600 text-white px-6 py-3.5 rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all font-bold"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Create New Quiz
              </Link>
              <button 
                onClick={() => document.getElementById('quiz-grid')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center justify-center bg-white/5 border border-white/10 text-white px-6 py-3.5 rounded-2xl hover:bg-white/10 transition-all font-bold"
              >
                Browse All
              </button>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
              <StatCard icon={<Play className="w-4 h-4" />} label="Attempts" value={stats.totalAttempts} color="text-indigo-400" />
              <StatCard icon={<Target className="w-4 h-4" />} label="Avg Score" value={`${Math.round(stats.averagePercent)}%`} color="text-emerald-400" />
              <StatCard icon={<Zap className="w-4 h-4" />} label="XP Points" value={stats.totalScore * 10} color="text-orange-400" />
              <StatCard icon={<BookOpen className="w-4 h-4" />} label="Quizzes" value={quizzes.length} color="text-blue-400" />
            </div>
          )}
        </div>
      </Card>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search quizzes by title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${
                selectedCategory === cat 
                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz Grid */}
      <div id="quiz-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredQuizzes.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/5 rounded-3xl border border-white/10 border-dashed">
            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No quizzes found matching your filters.</p>
            <button onClick={() => { setSearch(''); setSelectedCategory('All'); }} className="text-indigo-400 font-bold mt-2">Clear all filters</button>
          </div>
        ) : (
          filteredQuizzes.map((quiz) => (
            <Card key={quiz.id} className="group relative bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/[0.08] hover:-translate-y-1.5 transition-all duration-300 flex flex-col h-full">
              <div className="p-6 space-y-4 flex-1">
                <div className="flex items-start justify-between">
                  <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                    quiz.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    quiz.difficulty === 'medium' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {quiz.difficulty}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <Zap className="w-3 h-3 text-indigo-400" />
                    {quiz._count.results} Plays
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{quiz.title}</h2>
                  <p className="text-slate-400 text-sm mt-2 line-clamp-2 h-10">
                    {quiz.description || 'No description provided.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/5 rounded-xl p-2.5 border border-white/5">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    {quiz._count.questions} Qs
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/5 rounded-xl p-2.5 border border-white/5">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    {Math.round(quiz.timeLimit / 60)} min
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 mt-auto">
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-[10px] font-bold grid place-items-center text-white">
                      {quiz.creator.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-slate-500">{quiz.creator.username}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                    {new Date(quiz.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <Link 
                  to={`/quiz/${quiz.id}`}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/10 group-hover:shadow-indigo-600/30 transition-all font-bold"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Take Quiz
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) => (
  <Card className="bg-white/5 border border-white/10 p-4 flex items-center gap-4">
    <div className={`h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-xl font-black text-white">{value}</div>
    </div>
  </Card>
);

export default Dashboard;
