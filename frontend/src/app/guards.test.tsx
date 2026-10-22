import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { UserDto } from '@quiz/shared';
import { RequireRole } from './guards';

let current: { user: UserDto | null; loading: boolean };
vi.mock('./auth', () => ({ useAuth: () => current, homeFor: () => '/' }));

const user = (role: UserDto['role']): UserDto => ({
  id: '1', username: 'u', email: 'u@x.io', name: null, avatarUrl: null, role, xp: 0, tier: 'Bronze', streakDays: 0, createdAt: '',
});

function setup(path = '/studio') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireRole roles={['ORGANIZER', 'ADMIN']} />}><Route path="/studio" element={<p>studio</p>} /></Route>
        <Route path="/forbidden" element={<p>forbidden</p>} />
        <Route path="/login" element={<p>login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('lets an allowed role through', () => { current = { user: user('ORGANIZER'), loading: false }; setup(); expect(screen.getByText('studio')).toBeInTheDocument(); });
  it('sends the wrong role to /forbidden', () => { current = { user: user('PARTICIPANT'), loading: false }; setup(); expect(screen.getByText('forbidden')).toBeInTheDocument(); });
  it('sends signed-out users to /login', () => { current = { user: null, loading: false }; setup(); expect(screen.getByText('login')).toBeInTheDocument(); });
  it('shows a spinner while the session loads', () => { current = { user: null, loading: true }; setup(); expect(screen.getByRole('status')).toBeInTheDocument(); });
});
