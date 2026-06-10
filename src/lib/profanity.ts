// Minimal Korean/English profanity list for MVP.
// v2: swap in fuller list (e.g. `korean-badwords`) or server-side.
const BASE_WORDS = [
  '시발',
  '씨발',
  '개새끼',
  '존나',
  '병신',
  '지랄',
  '미친놈',
  '미친년',
  '꺼져',
  'ㅅㅂ',
  'ㅂㅅ',
  'fuck',
  'shit',
  'bitch',
  'asshole',
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build one regex per word that tolerates obfuscation between letters:
//   - 잡문자/공백/숫자 사이 끼우기 ('시 발', '시0발')  -> [\s\W\d]*
//   - 같은 글자 반복 ('시이이발')                       -> 직전 글자 반복 허용
// 출력은 원문을 보존하고, 매칭만 이 패턴으로 수행한다(normalize 미사용).
function buildPattern(word: string): RegExp {
  const chars = [...word];
  const body = chars
    .map((ch) => {
      const esc = escapeRegex(ch);
      // 해당 글자 자체 + 같은 글자 반복 허용
      return `${esc}${esc}*`;
    })
    .join('[\\s\\W\\d]*');
  return new RegExp(body, 'gi');
}

// 모듈 로드 시 1회 컴파일해 캐싱.
const PATTERNS: RegExp[] = BASE_WORDS.map(buildPattern);

export function maskForTTS(text: string): string {
  let out = text;
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, '삐-');
  }
  return out;
}

export function containsProfanity(text: string): boolean {
  return PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}
