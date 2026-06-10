// Guards against malformed percent-encoding (e.g. a lone "%" or "%E0%A4")
// which makes decodeURIComponent throw a URIError and blank the screen.
// Falls back to the original input when decoding fails.
export function safeDecode(s?: string): string {
  try {
    return decodeURIComponent(s ?? '');
  } catch {
    return s ?? '';
  }
}
