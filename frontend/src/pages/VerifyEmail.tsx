import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import api from '../services/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification token is required');
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        setStatus('success');
        setMessage(response.data.message || 'Email verified successfully!');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Failed to verify email');
      }
    };

    verifyEmail();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#0b0f1a]">
      <Card className={`w-full max-w-md backdrop-blur-sm ${
        status === 'success'
          ? 'border border-green-900/40 bg-green-950/10'
          : status === 'error'
          ? 'border border-red-900/40 bg-red-950/10'
          : 'border border-indigo-900/40 bg-indigo-950/10'
      }`}>
        <div className="p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <h2 className="text-2xl font-bold text-white mb-2">Verifying...</h2>
              <p className="text-slate-400">Please wait while we verify your email</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-400 mb-2">Email Verified!</h2>
              <p className="text-slate-400 mb-4">{message}</p>
              <p className="text-sm text-slate-500">Redirecting to login...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-400 mb-2">Verification Failed</h2>
              <p className="text-slate-400 mb-4">{message}</p>
              <p className="text-sm text-slate-500">Please try registering again or contact support</p>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmail;
