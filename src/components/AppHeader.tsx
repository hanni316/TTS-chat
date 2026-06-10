import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
  subtitle?: string;
}

export function AppHeader({ title, back, right, subtitle }: Props) {
  const nav = useNavigate();
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center gap-3 border-b border-white/5 bg-bg-base/85 px-4 py-3 backdrop-blur-md">
      {back && (
        <button
          onClick={() => nav(-1)}
          aria-label="뒤로"
          className="rounded-full p-2 text-ink-mute hover:bg-bg-elevated"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-mute">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
