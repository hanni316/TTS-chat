import { useToastStore } from '@/state/toastStore';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-sm rounded-xl px-4 py-2 text-sm shadow-soft animate-fade-in ${
            t.kind === 'error'
              ? 'bg-danger/15 text-danger ring-1 ring-danger/30'
              : t.kind === 'success'
              ? 'bg-success/15 text-success ring-1 ring-success/30'
              : 'bg-bg-elevated text-ink'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
