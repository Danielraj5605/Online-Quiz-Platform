import { useEffect, useRef } from 'react';

export type GradingAction =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'save' }
  | { type: 'help' }
  | { type: 'level'; value: number };

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null } | null;
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** True when the key event came from somewhere the user is typing (or a control that owns the keys). */
export function isTypingTarget(t: KeyLike['target']) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName ?? '').toUpperCase();
  if (TYPING.has(tag)) return true;
  const role = t.getAttribute?.('role');
  return role === 'textbox' || role === 'combobox' || role === 'spinbutton' || role === 'slider';
}

/**
 * Maps a key event to a grading action.
 *  J / K        next / previous submission
 *  0–9          set the active criterion (or the question score) to that many points
 *  Enter        save and go to the next submission
 *  Ctrl/⌘+Enter save and next — also works while typing feedback
 *  ?            shortcut help
 * Plain-key shortcuts never fire while typing in a field, and never with Ctrl/Alt/⌘ held.
 */
export function resolveGradingShortcut(e: KeyLike): GradingAction | null {
  const typing = isTypingTarget(e.target);
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return { type: 'save' };
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return null;
  // Enter on a focused button/link activates it; only treat it as "save" from the page body
  if (e.key === 'Enter') {
    const tag = (e.target?.tagName ?? '').toUpperCase();
    if (tag === 'BUTTON' || tag === 'A') return null;
    return { type: 'save' };
  }
  if (e.key === 'j' || e.key === 'J') return { type: 'next' };
  if (e.key === 'k' || e.key === 'K') return { type: 'prev' };
  if (e.key === '?') return { type: 'help' };
  if (/^[0-9]$/.test(e.key)) return { type: 'level', value: Number(e.key) };
  return null;
}

/** Window-level keyboard handling; the latest handler is always used without re-subscribing. */
export function useGradingShortcuts(handler: (a: GradingAction) => void, enabled = true) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const a = resolveGradingShortcut({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, shiftKey: e.shiftKey, target: e.target as KeyLike['target'] });
      if (!a) return;
      e.preventDefault();
      ref.current(a);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [enabled]);
}

export const SHORTCUT_HELP: { keys: string[]; label: string }[] = [
  { keys: ['J'], label: 'Next submission' },
  { keys: ['K'], label: 'Previous submission' },
  { keys: ['0', '–', '9'], label: 'Give the highlighted criterion that many points (capped at its maximum)' },
  { keys: ['Enter'], label: 'Save and open the next submission' },
  { keys: ['Ctrl', 'Enter'], label: 'Save and next, even while typing feedback' },
  { keys: ['?'], label: 'Show this help' },
];
