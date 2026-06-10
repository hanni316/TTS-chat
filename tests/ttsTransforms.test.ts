import { describe, it, expect } from 'vitest';
import { prepareForSpeech } from '../src/lib/ttsTransforms';
import type { AppSettings } from '../src/types';

// Base settings; emoji + profanity masking on so transforms run by default.
const baseSettings: AppSettings = {
  globalMuted: false,
  autoplay: true,
  language: 'ko-KR',
  voiceURI: undefined,
  rate: 1.0,
  volume: 0.8,
  announceSender: true,
  emojiToSpeech: true,
  profanityMask: true,
  desktopNotifications: false,
};

describe('prepareForSpeech', () => {
  it('replaces URLs with "링크"', () => {
    const http = prepareForSpeech('이거 봐 https://example.com/foo 끝', baseSettings);
    expect(http.text).toContain('링크');
    expect(http.text).not.toContain('https://');

    const www = prepareForSpeech('www.naver.com 접속', baseSettings);
    expect(www.text).toContain('링크');
    expect(www.text).not.toContain('www.');
  });

  it('summarizes repeated Korean laugh jamo (ㅋㅋㅋ) to "웃음"', () => {
    const out = prepareForSpeech('대박 ㅋㅋㅋ 웃겨', baseSettings);
    expect(out.text).toContain('웃음');
    expect(out.text).not.toContain('ㅋㅋㅋ');
  });

  it('splits text longer than the safe chunk into multiple segments', () => {
    // > 220 chars of plain text with sentence boundaries to exercise splitting.
    const sentence = '안녕하세요 반갑습니다. ';
    const long = sentence.repeat(40); // ~440+ chars
    expect(long.length).toBeGreaterThan(220);

    const out = prepareForSpeech(long, baseSettings);
    expect(out.segments.length).toBeGreaterThan(1);
    // every segment must respect the chunk ceiling
    for (const seg of out.segments) {
      expect(seg.length).toBeLessThanOrEqual(220);
    }
  });

  it('keeps short text in a single segment', () => {
    const out = prepareForSpeech('짧은 메시지', baseSettings);
    expect(out.segments).toHaveLength(1);
  });
});
