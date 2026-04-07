import { useLocation, Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Award, RefreshCcw, Home, ListOrdered, Zap, Trophy, Star, Medal } from 'lucide-react';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ProgressRing } from '../components/ui/ProgressRing';
import { useAuth } from '../context/AuthContext';

interface ResultData {
  score: number;
  total: number;
  xpEarned: number;
  newTier?: string;
  newBadges?: string[];
  attemptId?: number;
}

const QuizResult = () => {
  const { id } = useParams();
  const location = useLocation();
  const locationData = location.state as ResultData | undefined;
  const { user } = useAuth();
  const [score, setScore] = useState<number>(0);
  const [displayScore, setDisplayScore] = useState<number>(0);
  const [total, setTotal] = useState<number>(locationData?.total || 0);
  const [responses, setResponses] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultData] = useState<ResultData | null>(locationData || null);

  useEffect(() => {
    const load = async () => {
      try {
        const [resResult, resBoard] = await Promise.all([
          api.get(`/quiz/${id}/results`),
          api.get(`/quiz/${id}/leaderboard`),
        ]);
        const finalScore = resResult.data?.result?.score ?? locationData?.score ?? 0;
        const finalTotal = resResult.data?.result?.total ?? locationData?.total ?? 0;

        setScore(finalScore);
        setTotal(finalTotal);
        setResponses(resResult.data.responses || []);
        setLeaderboard(resBoard.data || []);

        // Score counter animation
        let start = 0;
        const duration = 1500;
        const increment = finalScore / (duration / 16);
        const timer = setInterval(() => {
          start += increment;
          if (start >= finalScore) {
            setDisplayScore(finalScore);
            clearInterval(timer);
          } else {
            setDisplayScore(Math.floor(start));
          }
        }, 16);

      } catch (err) {
        setScore(locationData?.score || 0);
        setDisplayScore(locationData?.score || 0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  
  const getTierData = () => {
    if (percentage >= 80) return { 
      message: 'Excellent!', 
      sub: 'You are a true master of this topic!',
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      border: 'border-yellow-400/30',
      icon: <Trophy className="w-20 h-20 text-yellow-400 animate-bounce-in" />
    };
    if (percentage >= 60) return { 
      message: 'Good Job!', 
      sub: 'Great performance! Keep it up.',
      color: 'text-indigo-400',
      bg: 'bg-indigo-400/10',
      border: 'border-indigo-400/30',
      icon: <Star className="w-20 h-20 text-indigo-400 animate-bounce-in" />
    };
    return { 
      message: 'Keep Practicing!', 
      sub: 'Every attempt makes you better.',
      color: 'text-slate-400',
      bg: 'bg-slate-400/10',
      border: 'border-slate-400/30',
      icon: <Zap className="w-20 h-20 text-slate-400 animate-bounce-in" />
    };
  };

  const tier = getTierData();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 text-slate-100 relative overflow-hidden">
      {/* Celebration Effects (Pure CSS Confetti) */}
      {percentage >= 80 && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-2 h-2 rounded-full animate-confetti" 
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#6c5ce7', '#00d2ff', '#f59e0b', '#10b981'][Math.floor(Math.random() * 4)],
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}

      <Card className="text-center border border-white/10 bg-white/5 backdrop-blur-md relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 ${tier.color.replace('text', 'bg')}`} />
        
        <div className="flex justify-center mb-8 relative">
          {tier.icon}
          {user && (
            <div className="absolute -right-2 top-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-900/40 border border-indigo-500/30 text-xs font-bold text-white shadow-xl">
              {user.avatar ? (
                <img src={user.avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-indigo-600 grid place-items-center">{user.username.charAt(0)}</div>
              )}
              <span>{user.username}</span>
            </div>
          )}
        </div>
        
        <div className="animate-pop-in">
          <h1 className="text-5xl font-black mb-2 text-white tracking-tight">{tier.message}</h1>
          <p className="text-slate-400 text-lg mb-10">{tier.sub}</p>
        </div>
        
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <div className="rounded-3xl p-8 border border-white/10 bg-white/5 flex flex-col items-center justify-center relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <ProgressRing value={percentage} size={140} stroke={12} color="var(--primary)" trackColor="rgba(255,255,255,0.05)" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white leading-none">{displayScore}</span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">out of {total}</span>
              </div>
            </div>
            <div className="mt-4 text-sm font-bold text-indigo-400 uppercase tracking-widest">{percentage}% Accuracy</div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl p-6 border border-white/10 bg-white/5 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 border border-orange-500/20 grid place-items-center text-orange-400">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Experience</div>
                  <div className="text-2xl font-black text-white">+{resultData?.xpEarned || 0} XP</div>
                </div>
              </div>
              {resultData?.newTier && (
                <div className="text-orange-500 animate-pulse font-black text-sm">TIER UP!</div>
              )}
            </div>

            {/* New Badges */}
            {resultData?.newBadges && resultData.newBadges.length > 0 && (
              <div className="rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 grid place-items-center text-yellow-400">
                    <Medal className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest">New Badge{resultData.newBadges.length > 1 ? 's' : ''}!</div>
                    <div className="text-sm font-bold text-white">{resultData.newBadges.join(', ')}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Share Button */}
            <button className="w-full rounded-2xl p-4 border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center gap-2 text-indigo-400 hover:bg-indigo-500/20 transition-colors">
              <span className="text-sm font-bold">Share Results</span>
            </button>

            <div className="rounded-2xl p-6 border border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center text-emerald-400">
                  <Award className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Position</div>
                  <div className="text-2xl font-black text-white">#4</div>
                </div>
              </div>
              <div className="text-xs font-bold text-slate-400">Top 10%</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
          <Button
            as={Link}
            to={`/quiz/${id}`}
            className="h-14 px-8 shadow-xl shadow-indigo-600/20"
          >
            <RefreshCcw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
          <Button
            as={Link}
            to="/"
            variant="ghost"
            className="h-14 px-8 border border-white/10 bg-white/5 hover:bg-white/10"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </Card>

      {/* Answer Review */}
      {responses.length > 0 && (
        <Card className="border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 grid place-items-center text-indigo-400">
                <ListOrdered className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-white">Question Review</h2>
            </div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{responses.length} total questions</div>
          </div>

          <div className="grid gap-4">
            {responses.map((resp, idx) => {
              const correct = resp.question.options.find((o: any) => o.isCorrect);
              const isCorrect = correct && correct.id === resp.optionId;
              return (
                <div key={resp.id} className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div className="flex items-start gap-4">
                    <div className="text-xs font-black text-slate-600 mt-1">0{idx + 1}</div>
                    <div className="flex-1">
                      <div className="font-bold text-lg text-white mb-4 leading-snug">{resp.question.text}</div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className={`p-3 rounded-xl border ${isCorrect ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                          <div className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Your Answer</div>
                          <div className="font-bold">{resp.option.text}</div>
                        </div>
                        {!isCorrect && (
                          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                            <div className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-1">Correct Answer</div>
                            <div className="font-bold">{correct?.text}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mini Leaderboard */}
      {leaderboard.length > 0 && (
        <Card className="border border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 grid place-items-center text-yellow-500">
              <Trophy className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-white">Quiz Leaderboard</h2>
          </div>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((row: any, idx: number) => {
              const isCurrentUser = row.user.id === user?.id;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={row.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isCurrentUser ? 'bg-indigo-500/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10 scale-[1.02]' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-white/5 text-white font-black grid place-items-center text-sm border border-white/10">
                      {idx < 3 ? medals[idx] : idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        {row.user.username}
                        {isCurrentUser && <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-black uppercase">You</span>}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(row.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-white">{row.score} / {row.total}</div>
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{Math.round((row.score/row.total)*100)}% Accurate</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link to="/leaderboard" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">View Full Leaderboard →</Link>
          </div>
        </Card>
      )}
    </div>
  );
};

export default QuizResult;
