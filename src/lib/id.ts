export function uid(prefix = ''): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj?.randomUUID) {
    return `${prefix}${cryptoObj.randomUUID()}`;
  }
  const rnd = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rnd}`;
}

export function friendshipKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

export function dmRoomKey(a: string, b: string): string {
  return `dm:${friendshipKey(a, b)}`;
}
