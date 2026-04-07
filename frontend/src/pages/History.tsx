import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import { Clock, Award, ArrowUpDown, Calendar, Target, History as HistoryIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';

interface HistoryItem {
  id: number;
  quizId: number;
  score: number;
  total: number;
  timeTaken: number;
  createdAt: string;
  quiz: { title: string; category: string };
}

const History = () => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/quiz/history/me');
        setItems(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortBy === 'score') comparison = (a.score / a.total) - (b.score / b.total);
      else if (sortBy === 'title') comparison = a.quiz.title.localeCompare(b.quiz.title);
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [items, sortBy, sortOrder]);

  const toggleSort = (key: 'date' | 'score' | 'title') => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-32" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(n => <Skeleton key={n} className="h-44" />)}
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8 text-slate-100 pb-24">
      <Card className="border border-indigo-900/40 bg-indigo-950/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <HistoryIcon className="w-24 h-24 text-indigo-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 grid place-items-center text-indigo-400 shadow-inner">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Performance Track</p>
              <h1 className="text-3xl font-black text-white">Quiz History</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Attempts</div>
              <div className="text-xl font-black text-white">{items.length}</div>
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avg Accuracy</div>
              <div className="text-xl font-black text-white">
                {items.length > 0 ? Math.round(items.reduce((acc, curr) => acc + (curr.score / curr.total), 0) / items.length * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-2">Sort by:</span>
        <SortButton active={sortBy === 'date'} label="Recent" onClick={() => toggleSort('date')} order={sortBy === 'date' ? sortOrder : undefined} />
        <SortButton active={sortBy === 'score'} label="Highest Score" onClick={() => toggleSort('score')} order={sortBy === 'score' ? sortOrder : undefined} />
        <SortButton active={sortBy === 'title'} label="Quiz Title" onClick={() => toggleSort('title')} order={sortBy === 'title' ? sortOrder : undefined} />
      </div>

      {sortedItems.length === 0 ? (
        <Card className="text-center py-20 bg-white/5 border border-white/10 border-dashed">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">No attempts recorded yet.</p>
          <Link to="/" className="text-indigo-400 font-bold mt-2 inline-block">Take your first quiz →</Link>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {sortedItems.map((item) => {
            const percent = Math.round((item.score / item.total) * 100);
            return (
              <Card key={item.id} className="group bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/[0.08] transition-all duration-300">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">{item.quiz.category || 'General'}</div>
                    <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{item.quiz.title}</h3>
                  </div>
                  <div className={`h-12 w-12 rounded-2xl border flex flex-col items-center justify-center font-black transition-all ${
                    percent >= 80 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                    percent >= 50 ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' :
                    'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    <span className="text-sm">{percent}%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-slate-500">Accuracy</span>
                    <span className="text-white">{item.score} / {item.total} Correct</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        percent >= 80 ? 'bg-emerald-500' :
                        percent >= 50 ? 'bg-indigo-500' :
                        'bg-red-500'
                      }`} 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Target className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{item.timeTaken}s</span>
                    </div>
                  </div>
                  <Link 
                    to={`/quiz/${item.quizId}`} 
                    className="text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Retake →
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SortButton = ({ active, label, onClick, order }: { active: boolean; label: string; onClick: () => void; order?: 'asc' | 'desc' }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
      active 
        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
        : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'
    }`}
  >
    {label}
    {active && order && <ArrowUpDown className={`w-3 h-3 ${order === 'asc' ? 'rotate-180' : ''} transition-transform`} />}
  </button>
);

export default History;
