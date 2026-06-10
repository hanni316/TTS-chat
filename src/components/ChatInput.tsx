import { useState } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { ttsEngine } from '@/tts/ttsEngine';

interface Props {
  onSend: (text: string) => Promise<boolean> | boolean;
  onTyping: (typing: boolean) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onTyping, disabled }: Props) {
  const [value, setValue] = useState('');
  const settings = useSettingsStore((s) => s.settings);
  const remaining = 500 - value.length;
  const canSend = value.trim().length > 0 && remaining >= 0 && !disabled;

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    setValue('');
    onTyping(false);
    const ok = await onSend(text);
    if (!ok) {
      // Restore the text so a failed send doesn't lose what the user typed.
      setValue(text);
      onTyping(true);
    }
  };

  const onPreview = () => {
    if (!value.trim()) return;
    ttsEngine.speak({ text: value, announceSender: false }, settings);
  };

  return (
    <div className="safe-bottom border-t border-white/5 bg-bg-base/95 px-3 py-2 backdrop-blur">
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onTyping(e.target.value.length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          onBlur={() => onTyping(false)}
          placeholder="메시지를 입력하세요 (Enter 전송)"
          maxLength={520}
          className="input max-h-32 min-w-0 flex-1 resize-none py-2.5 text-sm"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onPreview}
          disabled={!value.trim()}
          title="보내기 전 미리듣기"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg-elevated text-ink-mute disabled:opacity-50 hover:text-brand"
          aria-label="미리듣기"
        >
          🔊
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className="btn-primary h-11 shrink-0 whitespace-nowrap px-4"
        >
          전송
        </button>
      </div>
      {/* Always rendered so the input bar never shifts vertically when typing.
          The counter is hidden until the user actually starts typing. */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-dim">
        <span className={value.length > 0 ? '' : 'invisible'}>{value.length}/500</span>
        {remaining < 0 && <span className="text-danger">너무 길어요</span>}
      </div>
    </div>
  );
}
