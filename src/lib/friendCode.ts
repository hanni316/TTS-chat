// Friend code spec (planning doc §2):
// - 5 characters
// - uppercase letters + digits
// - exclude confusing chars: 0, O, 1, I, L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const FRIEND_CODE_LENGTH = 5;

export function generateFriendCode(): string {
  let out = '';
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    let r: number;
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      r = buf[0] % ALPHABET.length;
    } else {
      r = Math.floor(Math.random() * ALPHABET.length);
    }
    out += ALPHABET[r];
  }
  return out;
}

export function isValidFriendCode(code: string): boolean {
  if (code.length !== FRIEND_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}
