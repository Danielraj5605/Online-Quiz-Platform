import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Reset token is required');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0b0f1a]">
        <Card className="w-full max-w-md border border-red-900/40 bg-red-950/10 backdrop-blur-sm p-8 text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Invalid Reset Link</h2>
          <p className="text-slate-400 mb-6">This password reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300">
            Request a new reset link
          </Link>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0b0f1a]">
        <Card className="w-full max-w-md border border-green-900/40 bg-green-950/10 backdrop-blur-sm p-8 text-center">
          <h2 className="text-2xl font-bold text-green-400 mb-4">Password Reset!</h2>
          <p className="text-slate-400 mb-6">Your password has been reset successfully.</p>
          <p className="text-sm text-slate-500">Redirecting to login...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0b0f1a]">
      <Card className="w-full max-w-md border border-indigo-900/40 bg-indigo-950/10 backdrop-blur-sm">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Set New Password</h1>
            <p className="text-slate-400">Enter your new password below</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="password"
              label="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars with uppercase, number, symbol"
              required
            />

            <Input
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />

            <Button type="submit" className="w-full" loading={isLoading}>
              Reset Password
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

export default ResetPassword;
