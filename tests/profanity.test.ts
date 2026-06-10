import { describe, it, expect } from 'vitest';
import { maskForTTS, containsProfanity } from '../src/lib/profanity';

describe('maskForTTS', () => {
  it('replaces Korean profanity with "삐-"', () => {
    expect(maskForTTS('시발 진짜')).toContain('삐-');
    expect(maskForTTS('시발 진짜')).not.toContain('시발');
    expect(maskForTTS('개새끼야')).toContain('삐-');
  });

  it('replaces English profanity with "삐-" (case-insensitive)', () => {
    expect(maskForTTS('what the FUCK')).toContain('삐-');
    expect(maskForTTS('what the FUCK')).not.toMatch(/fuck/i);
  });

  // After the non-destructive fix, clean text must be returned untouched —
  // no lowercasing, no repeated-char collapsing, no other mutation.
  it('leaves a clean sentence completely unchanged', () => {
    const clean = '안녕하세요 Hello World 반갑습니다!';
    expect(maskForTTS(clean)).toBe(clean);
  });

  it('does not lowercase clean English text', () => {
    const clean = 'Good Morning Everyone';
    expect(maskForTTS(clean)).toBe(clean);
  });

  it('does not collapse repeated characters in clean text', () => {
    const clean = '좋아아아아 wooooow';
    expect(maskForTTS(clean)).toBe(clean);
  });
});

describe('containsProfanity', () => {
  it('detects profanity', () => {
    expect(containsProfanity('병신 같은')).toBe(true);
    expect(containsProfanity('this is shit')).toBe(true);
  });

  it('returns false for clean text', () => {
    expect(containsProfanity('안녕하세요 좋은 하루')).toBe(false);
  });
});
