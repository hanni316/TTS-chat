import { useState } from 'react';
import type { Message, UserProfile } from '@/types';

interface Props {
  message: Message;
  sender?: UserProfile;
  isMe: boolean;
  showSender: boolean; // for groups
  senderColor?: string;
  readByLabel?: string;
  onReplay?: () => void;
  onDelete?: () => void;
}

export function MessageBubble({
  message,
  sender,
  isMe,
  showSender,
  senderColor,
  readByLabel,
  onReplay,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const time = new Date(message.createdAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const canDelete =
    isMe && onDelete && !message.deleted && Date.now() - new Date(message.createdAt).getTime() < 5 * 60 * 1000;

  return (
    <div className={`flex animate-fade-in flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      {showSender && !isMe && sender && (
        <div
          className="mb-1 text-[11px] font-semibold"
          style={{ color: senderColor ?? '#A6AEC0' }}
        >
          {sender.nickname}
        </div>
      )}
      <div className={`flex max-w-[82%] items-end gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`relative rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-soft ${
            message.deleted
              ? 'bg-bg-elevated text-ink-dim italic'
              : isMe
              ? 'bg-brand text-white'
              : 'bg-bg-surface text-ink ring-1 ring-white/5'
          } ${isMe ? 'rounded-br-md' : 'rounded-bl-md'} text-left`}
        >
          {message.deleted ? '삭제된 메시지' : message.text}
        </button>
        <div className="mb-1 flex flex-col items-end gap-0.5 text-[10px] text-ink-dim">
          {readByLabel && <span>{readByLabel}</span>}
          <span>{time}</span>
        </div>
      </div>
      {open && !message.deleted && (
        <div
          className={`mt-1 flex gap-2 text-xs ${isMe ? 'justify-end' : 'justify-start'}`}
        >
          {onReplay && (
            <button onClick={onReplay} className="chip hover:text-brand">
              🔁 다시 듣기
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="chip text-danger hover:bg-danger/10">
              삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
