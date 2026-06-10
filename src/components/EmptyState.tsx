interface Props {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, icon, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-bg-elevated text-ink-mute">
        {icon ?? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </div>
      <div className="text-base font-semibold">{title}</div>
      {description && <div className="max-w-xs text-sm text-ink-mute">{description}</div>}
      {action}
    </div>
  );
}
