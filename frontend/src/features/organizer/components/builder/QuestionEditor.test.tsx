import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionEditor } from './QuestionEditor';
import { blankDraft, validateDraft, type QuestionDraft } from './question-draft';

function Harness({ initial = blankDraft('MCQ_SINGLE') }: { initial?: QuestionDraft }) {
  const [d, setD] = useState(initial);
  const v = validateDraft(d);
  return (
    <>
      <QuestionEditor draft={d} errors={v.errors} warnings={v.warnings} onChange={setD} idPrefix="t" />
      <output data-testid="valid">{String(v.valid)}</output>
    </>
  );
}

describe('QuestionEditor', () => {
  it('lets you build a valid single-choice question with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByTestId('valid')).toHaveTextContent('false');
    await user.type(screen.getByRole('textbox', { name: /^question/i }), 'Capital of France?');
    await user.type(screen.getByLabelText('Option 1 text'), 'Paris');
    await user.type(screen.getByLabelText('Option 2 text'), 'Rome');
    await user.type(screen.getByLabelText('Option 3 text'), 'Oslo');
    expect(screen.getByTestId('valid')).toHaveTextContent('true');
  });

  it('shows an error next to an empty option and removes it once filled', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText('Option 1 text'), 'x');
    expect(screen.getByLabelText('Option 1 text')).not.toHaveAttribute('aria-invalid');
  });

  it('adds and removes options, never dropping below two', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add option/i }));
    expect(screen.getByLabelText('Option 4 text')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove option 4' }));
    await user.click(screen.getByRole('button', { name: 'Remove option 3' }));
    expect(screen.getByRole('button', { name: 'Remove option 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove option 2' })).toBeDisabled();
  });

  it('marks exactly one option correct for single choice', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText('Option 2 is the correct answer'));
    expect(screen.getByLabelText('Option 1 is the correct answer')).not.toBeChecked();
    expect(screen.getByLabelText('Option 2 is the correct answer')).toBeChecked();
  });

  it('shows type-specific fields for numeric and short-answer questions', () => {
    const { unmount } = render(<Harness initial={blankDraft('NUMERIC')} />);
    expect(screen.getByLabelText(/correct answer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tolerance/i)).toBeInTheDocument();
    unmount();
    render(<Harness initial={blankDraft('SHORT_ANSWER')} />);
    expect(screen.getByRole('button', { name: /add accepted answer/i })).toBeInTheDocument();
  });

  it('shows the rubric editor for long-answer questions', async () => {
    const user = userEvent.setup();
    render(<Harness initial={blankDraft('LONG_ANSWER')} />);
    await user.click(screen.getByRole('button', { name: /add criterion/i }));
    expect(screen.getByLabelText('Criterion 1')).toBeInTheDocument();
  });
});
