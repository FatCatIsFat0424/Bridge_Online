import { describe, expect, it } from 'vitest';
import { THEMES, parseTheme } from '../../../client/src/stores/theme-store';

describe('parseTheme', () => {
  it('accepts every known theme', () => {
    for (const theme of THEMES) expect(parseTheme(theme)).toBe(theme);
  });
  it('falls back to dashboard for missing or unknown values', () => {
    expect(parseTheme(null)).toBe('dashboard');
    expect(parseTheme(undefined)).toBe('dashboard');
    expect(parseTheme('neon')).toBe('dashboard');
  });
});
