import { useEffect, useState } from 'react';
import api from '../services/api';
import { Trophy, Clock, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';

interface LeaderRow {
  id: number;
  score: number;
  total: number;
  timeTaken: number;
  createdAt: string;
  user: { id: number; username: string };
  quiz: { title: string };
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/leaderboard');
        setRows(res.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 text-slate-100">
      <Card className="flex items-center justify-between border border-indigo-900/40 bg-indigo-950/20 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Trophy className="w-32 h-32 text-indigo-400" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 grid place-items-center text-indigo-400 shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Global Ranking</p>
            <h1 className="text-3xl font-black text-white">Top Performers</h1>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-400">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>LIVE UPDATES</span>
        </div>
      </Card>

      <div className="grid gap-3 animate-pop-in">
        <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <span className="col-span-1">#</span>
          <span className="col-span-5">Player</span>
          <span className="col-span-3 hidden md:block">Quiz</span>
          <span className="col-span-2 text-center">Accuracy</span>
          <span className="col-span-1 text-right">Time</span>
        </div>
        
        {rows.map((row, idx) => {
          const percent = Math.round((row.score / row.total) * 100);
          const isCurrentUser = row.user.id === user?.id;
          
          return (
            <div 
              key={row.id} 
              className={`grid grid-cols-12 px-6 py-4 items-center rounded-2xl border transition-all duration-300 ${
                isCurrentUser 
                  ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10 scale-[1.01] relative z-10' 
                  : 'bg-white/5 border-white/10 hover:bg-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="col-span-1">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm ${
                  idx < 3 ? 'bg-white/5 border border-white/10' : 'text-slate-500'
                }`}>
                  {idx < 3 ? medals[idx] : idx + 1}
                </div>
              </div>
              
              <div className="col-span-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center font-bold text-indigo-400 text-xs shadow-inner">
                  {row.user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {row.user.username}
                    {isCurrentUser && <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-black uppercase">You</span>}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest md:hidden truncate max-w-[120px]">
                    {row.quiz.title}
                  </div>
                </div>
              </div>
              
              <div className="col-span-3 hidden md:block">
                <div className="text-sm font-medium text-slate-400 truncate">{row.quiz.title}</div>
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  {new Date(row.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              <div className="col-span-2">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">{percent}%</span>
                    <span className="text-[10px] font-bold text-slate-500">({row.score}/{row.total})</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden max-w-[80px]">
                    <div 
                      className="h-full bg-indigo-500" 
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="col-span-1 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs font-bold">{row.timeTaken}s</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
