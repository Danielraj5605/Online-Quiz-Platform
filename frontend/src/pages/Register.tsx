import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/register', { username, email, password });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative px-4 py-12 sm:py-16 md:py-20">
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
        <Card className="hidden lg:block lg:col-span-2 space-y-4 bg-white/10 border border-blue-900/40">
          <p className="inline-flex items-center text-xs font-semibold text-blue-200 bg-blue-900/40 px-3 py-1 rounded-full uppercase tracking-wide">
            Get started
          </p>
          <h2 className="text-4xl font-black text-white leading-tight">
            Join Quizzo and launch beautiful, fast quizzes.
          </h2>
          <p className="text-slate-300">
            Build question banks, collect results instantly, and keep participants engaged on every screen size.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold">Responsive</span>
            <span className="px-4 py-2 rounded-full bg-blue-900/40 text-blue-100 text-sm font-semibold">Live progress</span>
            <span className="px-4 py-2 rounded-full bg-emerald-900/40 text-emerald-100 text-sm font-semibold">Secure auth</span>
          </div>
        </Card>

        <div className="w-full lg:col-span-3">
          <Card className="bg-white/10 border border-blue-900/40">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-white">Create an Account</h2>
              <span className="text-xs font-semibold text-blue-200 bg-blue-900/40 px-3 py-1 rounded-full">Step 1/2</span>
            </div>
            {error && (
              <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/40 rounded border border-red-500/40">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Choose something memorable"
              />
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
                placeholder="At least 6 characters"
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat password"
              />
              <Button type="submit" loading={isLoading} className="w-full">
                {isLoading ? 'Registering...' : 'Create account'}
              </Button>
            </form>
            <p className="mt-4 text-sm text-center text-slate-300">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-200 font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Register;
