import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('fires onClick and defaults to type=button', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b).toHaveAttribute('type', 'button');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and busy while loading, and ignores clicks', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const b = screen.getByRole('button', { name: /save/i });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders as a link with asChild', () => {
    render(<Button asChild><a href="/x">Go</a></Button>);
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/x');
  });
});
