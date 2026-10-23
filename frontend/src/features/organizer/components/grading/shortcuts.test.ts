import { describe, expect, it } from 'vitest';
import { isTypingTarget, resolveGradingShortcut } from './shortcuts';

const body = { tagName: 'BODY' };
const input = { tagName: 'INPUT' };
const textarea = { tagName: 'TEXTAREA' };

describe('resolveGradingShortcut', () => {
  it('maps navigation and help keys from the page body', () => {
    expect(resolveGradingShortcut({ key: 'j', target: body })).toEqual({ type: 'next' });
    expect(resolveGradingShortcut({ key: 'K', target: body })).toEqual({ type: 'prev' });
    expect(resolveGradingShortcut({ key: '?', target: body })).toEqual({ type: 'help' });
  });

  it('maps digits to rubric levels', () => {
    expect(resolveGradingShortcut({ key: '0', target: body })).toEqual({ type: 'level', value: 0 });
    expect(resolveGradingShortcut({ key: '7', target: body })).toEqual({ type: 'level', value: 7 });
  });

  it('never fires plain-key shortcuts while typing in a field', () => {
    for (const target of [input, textarea, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
      expect(resolveGradingShortcut({ key: 'j', target })).toBeNull();
      expect(resolveGradingShortcut({ key: '3', target })).toBeNull();
      expect(resolveGradingShortcut({ key: 'Enter', target })).toBeNull();
    }
  });

  it('treats custom text-like roles as typing targets', () => {
    const t = { tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'spinbutton' : null) };
    expect(isTypingTarget(t)).toBe(true);
    expect(resolveGradingShortcut({ key: '5', target: t })).toBeNull();
  });

  it('Enter saves from the body but leaves focused buttons alone', () => {
    expect(resolveGradingShortcut({ key: 'Enter', target: body })).toEqual({ type: 'save' });
    expect(resolveGradingShortcut({ key: 'Enter', target: { tagName: 'BUTTON' } })).toBeNull();
    expect(resolveGradingShortcut({ key: 'Enter', target: { tagName: 'A' } })).toBeNull();
  });

  it('Ctrl/⌘+Enter saves even while typing feedback', () => {
    expect(resolveGradingShortcut({ key: 'Enter', ctrlKey: true, target: textarea })).toEqual({ type: 'save' });
    expect(resolveGradingShortcut({ key: 'Enter', metaKey: true, target: input })).toEqual({ type: 'save' });
  });

  it('ignores modified keys so browser shortcuts keep working', () => {
    expect(resolveGradingShortcut({ key: 'j', ctrlKey: true, target: body })).toBeNull();
    expect(resolveGradingShortcut({ key: 'k', metaKey: true, target: body })).toBeNull();
    expect(resolveGradingShortcut({ key: '1', altKey: true, target: body })).toBeNull();
  });

  it('ignores unrelated keys', () => {
    expect(resolveGradingShortcut({ key: 'a', target: body })).toBeNull();
    expect(resolveGradingShortcut({ key: 'Escape', target: body })).toBeNull();
  });
});
