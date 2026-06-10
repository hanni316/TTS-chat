// TTS preprocessing rules (planning doc §4 "TTS 처리 예외 규칙").
import { containsProfanity, maskForTTS } from './profanity';
import type { AppSettings } from '@/types';

// A tiny emoji → 한국어 사전. Falls back to "이모지".
const EMOJI_MAP: Array<[RegExp, string]> = [
  [/😀|😃|😄|😁|😆|🙂/gu, '웃는 얼굴'],
  [/😂|🤣/gu, '폭소'],
  [/😊|☺️/gu, '미소'],
  [/😉/gu, '윙크'],
  [/😍|🥰/gu, '하트 눈'],
  [/😘/gu, '뽀뽀'],
  [/😎/gu, '선글라스'],
  [/😢|😭/gu, '우는 얼굴'],
  [/😡|🤬/gu, '화난 얼굴'],
  [/😱/gu, '놀란 얼굴'],
  [/🤔/gu, '생각하는 얼굴'],
  [/👍/gu, '엄지'],
  [/👎/gu, '엄지 다운'],
  [/👏/gu, '박수'],
  [/🙏/gu, '부탁'],
  [/🔥/gu, '불'],
  [/❤️|🧡|💛|💚|💙|💜|🤍|🖤|🤎|♥️/gu, '하트'],
  [/💔/gu, '깨진 하트'],
  [/✨/gu, '반짝'],
  [/🎉|🎊/gu, '축하'],
  [/💯/gu, '백 점'],
];

const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
// Repeated jamo (ㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠㅠ, ㅜㅜㅜ, ㄷㄷ)
const KOREAN_LAUGH = /[ㅋㅎ]{2,}/g;
const KOREAN_CRY = /[ㅠㅜ]{2,}/g;
const KOREAN_SHOCK = /[ㄷ]{2,}/g;

export interface PreparedSpeech {
  text: string;
  containedProfanity: boolean;
  segments: string[]; // for chunked playback of very long text
}

const SAFE_CHUNK = 220; // chars; Web Speech API can choke on very long strings

export function prepareForSpeech(raw: string, settings: AppSettings): PreparedSpeech {
  let text = raw;

  // 1. URL → "링크"
  text = text.replace(URL_RE, '링크');

  // 2. 자모음 반복 → 요약
  text = text.replace(KOREAN_LAUGH, '웃음');
  text = text.replace(KOREAN_CRY, '훌쩍');
  text = text.replace(KOREAN_SHOCK, '깜짝');

  // 3. 이모지 → 한국어 (옵션)
  if (settings.emojiToSpeech) {
    for (const [re, word] of EMOJI_MAP) {
      text = text.replace(re, ` ${word} `);
    }
    // 미지정 이모지(유니코드 픽토그래픽) → "이모지"
    text = text.replace(/\p{Extended_Pictographic}/gu, ' 이모지 ');
  } else {
    // 이모지 음독을 끈 경우엔 픽토그래픽을 그냥 제거
    text = text.replace(/\p{Extended_Pictographic}/gu, '');
  }

  // 4. 욕설 마스킹
  // 정규화 부작용으로 인한 오탐을 막기 위해, 실제 치환 여부를
  // containsProfanity로 사전 검사한 뒤 마스킹한다.
  let containedProfanity = false;
  if (settings.profanityMask) {
    containedProfanity = containsProfanity(text);
    if (containedProfanity) {
      text = maskForTTS(text);
    }
  }

  // 정리: 여러 공백/줄바꿈 정리
  text = text.replace(/\s+/g, ' ').trim();

  // 5. 너무 긴 메시지는 분할
  const segments = splitForSpeech(text, SAFE_CHUNK);

  return {
    text,
    containedProfanity,
    segments: segments.length > 0 ? segments : [''],
  };
}

function splitForSpeech(text: string, chunk: number): string[] {
  if (text.length <= chunk) return [text];
  const out: string[] = [];
  // split on punctuation boundaries when possible
  const sentences = text.split(/(?<=[.!?…。？！])\s+/);
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length > chunk) {
      if (buf) out.push(buf.trim());
      if (s.length > chunk) {
        // hard split very long single "sentence"
        for (let i = 0; i < s.length; i += chunk) {
          out.push(s.slice(i, i + chunk));
        }
        buf = '';
      } else {
        buf = s;
      }
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
