import { useEffect, useState } from 'react';
import api from '../services/api';
import { Shield, Users, BarChart3, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [u, q, a] = await Promise.all([
          api.get('/admin/users'),
          api.get('/admin/quizzes'),
          api.get('/admin/analytics'),
        ]);
        setUsersList(u.data);
        setQuizzes(q.data);
        setAnalytics(a.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };
    if (user?.role === 'admin') {
      load();
    }
  }, [user]);

  if (user?.role !== 'admin') return <div className="p-8 text-center text-red-400">Admin access only.</div>;
  if (loading) return <div className="p-8 text-center text-slate-400">Loading admin dashboard...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6 text-slate-100">
      <Card className="border border-indigo-900/40 bg-indigo-950/20 flex items-center gap-4">
        <Shield className="w-8 h-8 text-indigo-400" />
        <div>
          <p className="text-sm font-semibold text-indigo-300 uppercase tracking-wide">Admin</p>
          <h1 className="text-3xl font-black text-white">Control center</h1>
        </div>
      </Card>

      {analytics && (
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard icon={<Users className="w-5 h-5" />} label="Users" value={analytics.totals.users} />
          <StatCard icon={<Layers className="w-5 h-5" />} label="Quizzes" value={analytics.totals.quizzes} />
          <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Results" value={analytics.totals.results} />
          <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Attempts" value={analytics.totals.attempts} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border border-slate-800 bg-slate-900/40">
          <h2 className="text-lg font-bold mb-3 text-white">Recent Users</h2>
          <div className="space-y-2 max-h-72 overflow-auto custom-scrollbar">
            {usersList.map((u) => (
              <div key={u.id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                <div>
                  <div className="font-semibold text-slate-200">{u.username}</div>
                  <div className="text-slate-500">{u.email}</div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10 self-start">{u.role}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-slate-800 bg-slate-900/40">
          <h2 className="text-lg font-bold mb-3 text-white">Quizzes</h2>
          <div className="space-y-2 max-h-72 overflow-auto custom-scrollbar">
            {quizzes.map((q) => (
              <div key={q.id} className="flex justify-between text-sm border-b border-white/5 pb-2">
                <div>
                  <div className="font-semibold text-slate-200">{q.title}</div>
                  <div className="text-slate-500">by {q.creator.username}</div>
                </div>
                <div className="text-xs text-slate-500 self-start">{q._count.questions} questions</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <Card className="border border-slate-800 bg-slate-900/60 flex items-center gap-3">
    <div className="h-10 w-10 rounded-full bg-white/5 text-indigo-400 grid place-items-center border border-white/10">{icon}</div>
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  </Card>
);

export default AdminDashboard;
