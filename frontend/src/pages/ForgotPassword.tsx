import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message);
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0b0f1a]">
      <Card className="w-full max-w-md border border-indigo-900/40 bg-indigo-950/10 backdrop-blur-sm">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Reset Password</h1>
            <p className="text-slate-400">Enter your email to receive a reset link</p>
          </div>

          {message && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            <Button type="submit" className="w-full" loading={isLoading}>
              Send Reset Link
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-indigo-400 hover:text-indigo-300">
              Back to login
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
