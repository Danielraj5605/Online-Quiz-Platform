import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.user, response.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative px-4 py-12 sm:py-16 md:py-20">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
        <Card className="hidden lg:block lg:col-span-2 space-y-4 bg-white/10 border border-blue-900/40">
          <p className="inline-flex items-center text-xs font-semibold text-blue-200 bg-blue-900/40 px-3 py-1 rounded-full uppercase tracking-wide">
            Welcome back
          </p>
          <h2 className="text-4xl font-black text-white leading-tight">
            Sign in and keep your quizzes flowing.
          </h2>
          <p className="text-slate-300">
            Create, host, and track quizzes with instant results. Built for fast iteration and smooth delivery on any device.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-4 rounded-xl bg-blue-900/40 text-blue-100 font-semibold">
              Live progress bars
            </div>
            <div className="p-4 rounded-xl bg-slate-900 text-white font-semibold">
              Mobile-first layout
            </div>
            <div className="p-4 rounded-xl bg-slate-800 text-slate-100 font-semibold border border-slate-700">
              Secure sessions
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-semibold">
              Instant feedback
            </div>
          </div>
        </Card>

        <div className="w-full lg:col-span-3">
          <Card className="bg-white/10 border border-blue-900/40">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">Login</h2>
              <span className="text-xs font-semibold text-emerald-200 bg-emerald-900/50 px-3 py-1 rounded-full">Secure</span>
            </div>
            {error && (
              <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/40 rounded border border-red-500/40">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Your secret key"
              />
              <Button type="submit" loading={isLoading} className="w-full">
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
            <div className="flex items-center justify-between mt-4 text-sm">
              <Link to="/forgot-password" className="text-blue-200 hover:text-blue-100">
                Forgot password?
              </Link>
              <Link to="/register" className="text-blue-200 hover:text-blue-100">
                Create an account
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
