import { describe, it, expect } from 'vitest';
import {
  isValidFriendCode,
  generateFriendCode,
  FRIEND_CODE_LENGTH,
} from '../src/lib/friendCode';

// ALPHABET excludes confusing chars: 0, O, 1, I, L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

describe('isValidFriendCode', () => {
  it('accepts a valid 5-char code made of ALPHABET chars', () => {
    expect(isValidFriendCode('ABCDE')).toBe(true);
    expect(isValidFriendCode('23456')).toBe(true);
    expect(isValidFriendCode('XYZ29')).toBe(true);
  });

  it('rejects codes that are not exactly 5 chars', () => {
    expect(isValidFriendCode('')).toBe(false);
    expect(isValidFriendCode('ABCD')).toBe(false);
    expect(isValidFriendCode('ABCDEF')).toBe(false);
  });

  it('rejects codes containing excluded chars (0, O, 1, I, L)', () => {
    expect(isValidFriendCode('ABCD0')).toBe(false);
    expect(isValidFriendCode('ABCDO')).toBe(false);
    expect(isValidFriendCode('ABCD1')).toBe(false);
    expect(isValidFriendCode('ABCDI')).toBe(false);
    expect(isValidFriendCode('ABCDL')).toBe(false);
  });
});

describe('generateFriendCode', () => {
  it('produces a 5-char code', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateFriendCode()).toHaveLength(FRIEND_CODE_LENGTH);
    }
  });

  it('only uses characters from ALPHABET', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateFriendCode();
      for (const ch of code) {
        expect(ALPHABET).toContain(ch);
      }
    }
  });

  it('always produces a valid friend code', () => {
    for (let i = 0; i < 100; i++) {
      expect(isValidFriendCode(generateFriendCode())).toBe(true);
    }
  });
});
