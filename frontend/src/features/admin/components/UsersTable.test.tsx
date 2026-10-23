import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminUserRow } from '@/lib/api';
import { UsersTable } from './UsersTable';

const user = (o: Partial<AdminUserRow>): AdminUserRow => ({
  id: 'u1', username: 'ada', email: 'ada@example.com', name: 'Ada', role: 'PARTICIPANT', disabled: false, createdAt: '2026-01-02T00:00:00.000Z',
  xp: 120, tier: 'Bronze', quizCount: 0, attemptCount: 3, ...o,
});

beforeAll(() => {
  // Radix Select relies on pointer-capture APIs jsdom does not implement
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.setPointerCapture ??= () => {};
});

function setup(rows: AdminUserRow[]) {
  const onChangeRole = vi.fn();
  const onToggleDisabled = vi.fn();
  render(
    <UsersTable rows={rows} onPageChange={() => {}} onSortChange={() => {}} currentUserId="me" onChangeRole={onChangeRole} onToggleDisabled={onToggleDisabled} />,
  );
  return { onChangeRole, onToggleDisabled };
}

// desktop table and mobile card list both render in jsdom (CSS hides one); act on the table
const table = () => screen.getByRole('table', { hidden: true });

describe('UsersTable actions', () => {
  it('lets an admin disable another user only after confirming', async () => {
    const { onToggleDisabled } = setup([user({})]);
    await userEvent.click(within(table()).getByRole('button', { name: 'Disable ada', hidden: true }));
    expect(onToggleDisabled).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/signed out everywhere/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disable account' }));
    expect(onToggleDisabled).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
  });

  it('offers re-enable for a disabled account', async () => {
    const { onToggleDisabled } = setup([user({ disabled: true })]);
    await userEvent.click(within(table()).getByRole('button', { name: 'Re-enable ada', hidden: true }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Re-enable' }));
    expect(onToggleDisabled).toHaveBeenCalledTimes(1);
  });

  it('does not allow acting on your own account', () => {
    const { onChangeRole, onToggleDisabled } = setup([user({ id: 'me', username: 'root', role: 'ADMIN' })]);
    expect(within(table()).getByRole('button', { name: 'Disable root', hidden: true })).toBeDisabled();
    expect(within(table()).getByRole('combobox', { name: 'Role for root', hidden: true })).toBeDisabled();
    expect(onChangeRole).not.toHaveBeenCalled();
    expect(onToggleDisabled).not.toHaveBeenCalled();
  });

  it('asks for confirmation before changing a role', async () => {
    const { onChangeRole } = setup([user({})]);
    await userEvent.click(within(table()).getByRole('combobox', { name: 'Role for ada', hidden: true }));
    await userEvent.click(await screen.findByRole('option', { name: 'Organizer' }));
    expect(onChangeRole).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));
    expect(onChangeRole).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 'ORGANIZER');
  });
});
