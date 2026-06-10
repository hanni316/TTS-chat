import { useTTSState } from '@/hooks/useTTSState';
import { ttsEngine } from '@/tts/ttsEngine';

export function TTSStatusBar() {
  const s = useTTSState();
  if (!s.speaking && s.queueLength === 0) return null;
  return (
    <div className="mx-3 mt-2 flex items-center gap-3 rounded-xl bg-brand/10 px-3 py-2 text-xs text-brand ring-1 ring-brand/30">
      <span className="inline-block h-2 w-2 animate-pulse-soft rounded-full bg-brand" />
      <span className="flex-1 truncate">
        {s.paused ? '일시정지됨' : '재생 중'} · 큐 {s.queueLength}개
      </span>
      {!s.paused ? (
        <button onClick={() => ttsEngine.pause()} className="text-brand hover:underline">
          일시정지
        </button>
      ) : (
        <button onClick={() => ttsEngine.resume()} className="text-brand hover:underline">
          재생
        </button>
      )}
      <button onClick={() => ttsEngine.clearQueue()} className="text-brand hover:underline">
        큐 비우기
      </button>
    </div>
  );
}
