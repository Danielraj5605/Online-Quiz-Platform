import { Link, useLocation } from 'react-router-dom';
import { Home, Trophy, PlusCircle, History, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null; // don't show bottom nav on auth pages

  const navItems = [
    { label: 'Home',        icon: Home,       path: '/' },
    { label: 'Ranking',     icon: Trophy,     path: '/leaderboard' },
    { label: 'Create',      icon: PlusCircle, path: '/create-quiz' },
    { label: 'History',     icon: History,    path: '/history' },
    { label: 'Profile',     icon: User,       path: '/profile' },
  ];

  return (
    <>
      {/* Only visible on mobile — hidden on lg+ via CSS class */}
      <div className="bottom-nav-mobile">
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '60px',
          padding: '0 4px',
        }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  minWidth: '56px',
                  padding: '6px 4px',
                  borderRadius: '12px',
                  textDecoration: 'none',
                  color: isActive ? 'var(--primary-bright)' : 'var(--text-muted)',
                  transition: 'color 0.2s',
                  background: isActive ? 'var(--primary-subtle)' : 'transparent',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default BottomNav;
