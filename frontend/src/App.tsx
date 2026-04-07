import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CreateQuiz from './pages/CreateQuiz';
import TakeQuiz from './pages/TakeQuiz';
import QuizResult from './pages/QuizResult';
import Profile from './pages/Profile';
import History from './pages/History';
import AdminDashboard from './pages/AdminDashboard';
import Leaderboard from './pages/Leaderboard';
import QuizDetail from './pages/QuizDetail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--primary-bright)',
      fontSize: '16px',
      fontWeight: 600,
      letterSpacing: '0.05em',
      gap: '12px',
    }}>
      <span style={{ animation: 'pulse-glow 1.5s infinite' }}>⚜</span>
      Loading...
    </div>
  );
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/create-quiz" element={<ProtectedRoute><CreateQuiz /></ProtectedRoute>} />
      <Route path="/quiz/:id" element={<ProtectedRoute><TakeQuiz /></ProtectedRoute>} />
      <Route path="/quiz/:id/info" element={<ProtectedRoute><QuizDetail /></ProtectedRoute>} />
      <Route path="/quiz/:id/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/result/:id" element={<ProtectedRoute><QuizResult /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', transition: 'background 0.3s, color 0.3s' }}>
            <Navbar />
            <main style={{ paddingBottom: '48px' }}>
              <AppRoutes />
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
