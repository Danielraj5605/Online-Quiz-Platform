import { describe, expect, it } from 'vitest';
import { defaultQuizSettings } from '@quiz/shared';
import { diffPatch, fromLocalInput, toLocalInput, validateSettings, type SettingsForm } from './settings-form';

const base = (): SettingsForm => ({
  title: 'Photosynthesis basics', description: '', categoryId: null, difficulty: 'MEDIUM', tags: [], settings: defaultQuizSettings(), opensAt: null, closesAt: null,
});

describe('validateSettings', () => {
  it('passes for defaults', () => expect(validateSettings(base())).toEqual({}));

  it('requires a title of 3+ characters', () => {
    expect(validateSettings({ ...base(), title: 'ab' }).title).toBeTruthy();
  });

  it('rejects closing before opening', () => {
    const f = { ...base(), opensAt: '2030-01-02T10:00:00.000Z', closesAt: '2030-01-02T09:00:00.000Z' };
    expect(validateSettings(f).closesAt).toMatch(/after/);
  });

  it('requires a grade band that starts at 0%', () => {
    const f = base();
    f.settings = { ...f.settings, gradeBands: [{ label: 'A', minPct: 90 }] };
    expect(validateSettings(f)['settings.gradeBands']).toMatch(/0%/);
  });

  it('flags out-of-range numbers from the shared schema', () => {
    const f = base();
    f.settings = { ...f.settings, passMarkPct: 140 };
    expect(Object.keys(validateSettings(f)).some((k) => k.includes('passMarkPct'))).toBe(true);
  });
});

describe('diffPatch', () => {
  it('returns nothing when unchanged', () => {
    expect(diffPatch(base(), base()).patch).toEqual({});
  });

  it('sends only changed keys and keeps the old values for undo', () => {
    const a = base();
    const b = { ...a, title: '  New title ', settings: { ...a.settings, maxAttempts: 3 } };
    const { patch, before } = diffPatch(a, b);
    expect(Object.keys(patch).sort()).toEqual(['settings', 'title']);
    expect(patch.title).toBe('New title');
    expect(before.title).toBe('Photosynthesis basics');
    expect(before.settings?.maxAttempts).toBe(1);
  });
});

describe('datetime-local conversion', () => {
  it('round-trips at minute precision and treats empty as null', () => {
    const iso = '2030-06-01T08:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });
});
