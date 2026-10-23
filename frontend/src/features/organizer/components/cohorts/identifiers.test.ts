import { describe, expect, it } from 'vitest';
import { parseIdentifiers } from './identifiers';

describe('parseIdentifiers', () => {
  it('splits on commas, whitespace and new lines and removes duplicates', () => {
    expect(parseIdentifiers('a, b\nc  a;d')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ignores empty input', () => {
    expect(parseIdentifiers('  \n , ')).toEqual([]);
  });
  it('caps the list at 500 entries', () => {
    expect(parseIdentifiers(Array.from({ length: 800 }, (_, i) => `u${i}`).join(' '))).toHaveLength(500);
  });
});
