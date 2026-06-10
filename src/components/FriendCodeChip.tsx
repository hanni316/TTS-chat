import { useState } from 'react';
import { useToastStore } from '@/state/toastStore';

interface Props {
  code: string;
  large?: boolean;
}

export function FriendCodeChip({ code, large }: Props) {
  const push = useToastStore((s) => s.push);
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      push('친구 코드를 복사했어요', 'success');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      push('복사에 실패했어요. 길게 눌러서 복사해 주세요.', 'error');
    }
  };
  return (
    <button
      onClick={onCopy}
      className={`group inline-flex items-center gap-2 rounded-2xl bg-bg-elevated px-4 ${
        large ? 'py-3' : 'py-2'
      } font-mono tracking-[0.35em] text-ink ring-1 ring-white/5 transition hover:ring-brand`}
      aria-label="친구 코드 복사"
    >
      <span className={large ? 'text-xl' : 'text-sm'}>{code}</span>
      <span className="text-xs font-sans tracking-normal text-ink-mute group-hover:text-brand">
        {copied ? '✓ 복사됨' : '복사'}
      </span>
    </button>
  );
}
