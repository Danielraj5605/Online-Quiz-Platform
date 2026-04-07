import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, PlusCircle, Menu, X, ChevronDown,
  Home, Trophy, History, User
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ThemeSwitcher from './ThemeSwitcher';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
    setProfileOpen(false);
  };

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  // Scroll shadow
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* ── Main top navbar ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${scrolled ? 'var(--border-glow)' : 'var(--border)'}`,
        boxShadow: scrolled ? 'var(--shadow-md)' : 'none',
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 16px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          {/* Logo */}
          <Link to="/" style={{
            display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0,
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary-dim), var(--primary-bright))',
              color: '#fff', display: 'grid', placeItems: 'center',
              fontWeight: 800, fontSize: '14px',
              boxShadow: '0 4px 12px var(--primary-glow)',
            }}>QZ</div>
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              Quizzo
            </span>
            <span className="nav-badge-royal">⚜ Royal</span>
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <nav className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, justifyContent: 'center' }}>
            {user && (
              <>
                <NavLink to="/"            label="Home"        active={isActive('/')} />
                <NavLink to="/leaderboard" label="Leaderboard" active={isActive('/leaderboard')} />
                <NavLink to="/history"     label="History"     active={isActive('/history')} />
                <NavLink to="/create-quiz" label="+ Create"    active={isActive('/create-quiz')} highlight />
              </>
            )}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <ThemeSwitcher />

            {user ? (
              <>
                {/* Profile dropdown — desktop only */}
                <div className="desktop-nav" ref={profileRef} style={{ position: 'relative' }}>
                  <button
                    id="nav-profile-btn"
                    onClick={() => setProfileOpen(p => !p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '6px 12px',
                      background: 'var(--surface-2)',
                      border: `1px solid ${profileOpen ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600,
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                    }}
                  >
                    <Avatar username={user.username} avatar={user.avatar} size={24} />
                    <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.username}
                    </span>
                    <ChevronDown size={13} style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: profileOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                  </button>

                  {profileOpen && (
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                      minWidth: '196px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      boxShadow: 'var(--shadow-lg)',
                      overflow: 'hidden',
                      zIndex: 200,
                      animation: 'fade-in 0.15s ease forwards',
                    }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar username={user.username} avatar={user.avatar} size={32} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{user.username}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.role}</div>
                        </div>
                      </div>
                      <div style={{ padding: '6px' }}>
                        <DropdownItem to="/profile"  label="⚜ My Profile" />
                        <DropdownItem to="/history"  label="📜 History" />
                        {user.role === 'admin' && <DropdownItem to="/admin" label="👑 Admin Panel" gold />}
                        <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                        <button
                          onClick={handleLogout}
                          style={{
                            width: '100%', textAlign: 'left', padding: '8px 12px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600, color: 'var(--error)',
                            borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                            fontFamily: 'inherit', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hamburger — mobile only */}
                <button
                  id="nav-hamburger"
                  className="mobile-only"
                  onClick={() => setMobileMenuOpen(o => !o)}
                  aria-label="Toggle menu"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '38px', height: '38px',
                    background: mobileMenuOpen ? 'var(--primary-subtle)' : 'var(--surface-2)',
                    border: `1px solid ${mobileMenuOpen ? 'var(--border-glow)' : 'var(--border)'}`,
                    borderRadius: '10px', cursor: 'pointer',
                    color: mobileMenuOpen ? 'var(--primary-bright)' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </>
            ) : (
              /* Auth links */
              <>
                <Link to="/login" style={{
                  padding: '7px 14px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 600,
                  color: 'var(--text-secondary)', textDecoration: 'none',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  transition: 'all 0.2s',
                }}>
                  Login
                </Link>
                <Link to="/register" style={{
                  padding: '7px 16px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 700,
                  color: '#fff', textDecoration: 'none',
                  background: 'linear-gradient(135deg, var(--primary-dim), var(--primary-bright))',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                  transition: 'all 0.2s',
                }}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile slide-down menu */}
        {mobileMenuOpen && user && (
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            animation: 'fade-in 0.2s ease forwards',
          }}>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* User info */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', background: 'var(--surface-2)',
                borderRadius: '12px', marginBottom: '4px',
                border: '1px solid var(--border)',
              }}>
                <Avatar username={user.username} avatar={user.avatar} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{user.username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user.role}</div>
                </div>
              </div>

              <MobileMenuLink to="/"            label="🏠 Home"         active={isActive('/')} />
              <MobileMenuLink to="/create-quiz" label="✨ Create Quiz"  active={isActive('/create-quiz')} highlight />
              <MobileMenuLink to="/leaderboard" label="🏆 Leaderboard" active={isActive('/leaderboard')} />
              <MobileMenuLink to="/history"     label="📜 History"      active={isActive('/history')} />
              <MobileMenuLink to="/profile"     label="⚜ Profile"      active={isActive('/profile')} />
              {user.role === 'admin' && (
                <MobileMenuLink to="/admin" label="👑 Admin Panel" active={isActive('/admin')} gold />
              )}

              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', textAlign: 'left', padding: '11px 14px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '10px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 600, color: 'var(--error)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontFamily: 'inherit',
                }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Bottom nav — mobile only, fixed to bottom ── */}
      {user && (
        <div className="bottom-nav-bar" role="navigation" aria-label="Bottom navigation">
          <BottomNavItem to="/"            icon={<Home size={22} />}       label="Home"      active={isActive('/')} />
          <BottomNavItem to="/leaderboard" icon={<Trophy size={22} />}     label="Ranking"   active={isActive('/leaderboard')} />
          <BottomNavItem to="/create-quiz" icon={<PlusCircle size={22} />} label="Create"    active={isActive('/create-quiz')} highlight />
          <BottomNavItem to="/history"     icon={<History size={22} />}    label="History"   active={isActive('/history')} />
          <BottomNavItem to="/profile"     icon={<User size={22} />}       label="Profile"   active={isActive('/profile')} />
        </div>
      )}
    </>
  );
};

/* ── Sub-components ── */
const Avatar = ({ username, avatar, size }: { username: string; avatar?: string; size: number }) => (
  avatar ? (
    <img src={avatar} alt="avatar" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--primary-dim), var(--primary-bright))',
      color: '#fff', display: 'grid', placeItems: 'center',
      fontSize: Math.round(size * 0.42) + 'px', fontWeight: 700,
    }}>
      {username.charAt(0).toUpperCase()}
    </div>
  )
);

const NavLink = ({ to, label, active, highlight }: { to: string; label: string; active: boolean; highlight?: boolean }) => (
  <Link to={to} style={{
    padding: '6px 14px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, textDecoration: 'none',
    color: active ? 'var(--primary-bright)' : highlight ? 'var(--primary-bright)' : 'var(--text-secondary)',
    background: active ? 'var(--primary-subtle)' : highlight ? 'var(--primary-subtle)' : 'transparent',
    border: highlight && !active ? '1px solid var(--border-glow)' : '1px solid transparent',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  }}>
    {label}
  </Link>
);

const DropdownItem = ({ to, label, gold }: { to: string; label: string; gold?: boolean }) => (
  <Link to={to} style={{
    display: 'block', padding: '8px 12px', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, textDecoration: 'none',
    color: gold ? 'var(--gold-bright)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  }}
    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLAnchorElement).style.color = gold ? 'var(--gold-bright)' : 'var(--text)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = gold ? 'var(--gold-bright)' : 'var(--text-secondary)'; }}
  >
    {label}
  </Link>
);

const MobileMenuLink = ({ to, label, active, highlight, gold }: { to: string; label: string; active: boolean; highlight?: boolean; gold?: boolean }) => (
  <Link to={to} style={{
    display: 'block', padding: '11px 14px', borderRadius: '10px',
    fontSize: '14px', fontWeight: 600, textDecoration: 'none',
    color: gold ? 'var(--gold-bright)' : active || highlight ? 'var(--primary-bright)' : 'var(--text)',
    background: gold ? 'rgba(212,175,55,0.08)' : active ? 'var(--primary-subtle)' : highlight ? 'var(--primary-subtle)' : 'var(--surface-2)',
    border: `1px solid ${gold ? 'var(--gold-glow)' : active || highlight ? 'var(--border-glow)' : 'var(--border)'}`,
    transition: 'all 0.15s',
  }}>
    {label}
  </Link>
);

const BottomNavItem = ({ to, icon, label, active, highlight }:
  { to: string; icon: React.ReactNode; label: string; active: boolean; highlight?: boolean }
) => (
  <Link to={to} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '3px', flex: 1, padding: '6px 4px', borderRadius: '12px', textDecoration: 'none',
    color: active ? 'var(--primary-bright)' : highlight ? 'var(--primary)' : 'var(--text-muted)',
    background: active ? 'var(--primary-subtle)' : 'transparent',
    transition: 'all 0.2s',
  }}>
    {icon}
    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </span>
  </Link>
);

export default Navbar;
