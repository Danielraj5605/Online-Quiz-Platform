import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { Palette } from 'lucide-react';
import { useState } from 'react';

const themes: { id: Theme; label: string; preview: string; accent: string }[] = [
  { id: 'royal-dark',    label: 'Midnight Crown',  preview: '#0d0a1e', accent: '#8b5cf6' },
  { id: 'royal-gold',   label: 'Golden Palace',   preview: '#1a1207', accent: '#d4af37' },
  { id: 'royal-violet', label: 'Amethyst Court',  preview: '#110d1e', accent: '#c084fc' },
  { id: 'royal-emerald',label: 'Emerald Throne',  preview: '#071a10', accent: '#10b981' },
  { id: 'royal-light',  label: 'Pearl Kingdom',   preview: '#f8f4ff', accent: '#7c3aed' },
];

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" style={{ zIndex: 50 }}>
      <button
        id="theme-switcher-btn"
        onClick={() => setOpen(o => !o)}
        title="Change theme"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--primary)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'all 0.2s',
        }}
      >
        <Palette size={15} />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px',
              minWidth: '200px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', paddingLeft: '8px', fontWeight: 700 }}>
              Royal Themes
            </p>
            {themes.map(t => (
              <button
                key={t.id}
                id={`theme-option-${t.id}`}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: theme === t.id ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                  background: theme === t.id ? 'var(--primary-subtle)' : 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: theme === t.id ? 700 : 500,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  display: 'inline-block',
                  background: `linear-gradient(135deg, ${t.preview} 50%, ${t.accent} 50%)`,
                  border: '2px solid rgba(255,255,255,0.15)',
                  flexShrink: 0,
                }} />
                {t.label}
                {theme === t.id && (
                  <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: '16px' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSwitcher;
