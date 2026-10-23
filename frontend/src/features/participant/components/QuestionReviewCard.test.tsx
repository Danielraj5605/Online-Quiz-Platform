import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResultQuestionReview } from '@quiz/shared';
import { QuestionReviewCard } from './QuestionReviewCard';

const base: ResultQuestionReview = {
  questionId: 'q1', text: 'What is 2 + 2?', type: 'MCQ_SINGLE', points: 2, score: null, isCorrect: null, needsManual: false,
  yourAnswer: { optionIds: ['b'] }, timeSpentMs: 4000, feedback: '',
  options: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }],
};

describe('QuestionReviewCard', () => {
  it('hides verdicts and the key when the organizer has not released answers', () => {
    render(<QuestionReviewCard r={base} index={0} />);
    expect(screen.getByText('Answer hidden')).toBeInTheDocument();
    expect(screen.getByText('Your answer')).toBeInTheDocument();
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    expect(screen.queryByText(/Explanation/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 pts/)).toBeInTheDocument();
  });

  it('shows the key, score and explanation when they are present', () => {
    render(<QuestionReviewCard r={{ ...base, score: 2, isCorrect: true, correct: { optionIds: ['b'] }, explanation: 'Basic addition.' }} index={0} />);
    expect(screen.getAllByText('Correct').length).toBeGreaterThan(0);
    expect(screen.getByText(/Basic addition\./)).toBeInTheDocument();
  });

  it('marks questions awaiting manual grading', () => {
    render(<QuestionReviewCard r={{ ...base, type: 'LONG_ANSWER', options: [], yourAnswer: { text: 'An essay' }, needsManual: true }} index={2} />);
    expect(screen.getByText('Awaiting grading')).toBeInTheDocument();
    expect(screen.getByText('An essay')).toBeInTheDocument();
    expect(screen.getByText('Q3')).toBeInTheDocument();
  });

  it('says so when a question was left unanswered', () => {
    render(<QuestionReviewCard r={{ ...base, yourAnswer: null }} index={0} />);
    expect(screen.getByText('You did not answer this question.')).toBeInTheDocument();
  });
});
