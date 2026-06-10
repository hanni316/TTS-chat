interface Props {
  name: string;
  url?: string;
  size?: number;
  className?: string;
}

const PALETTE = [
  ['#7C5CFF', '#22D3EE'],
  ['#F472B6', '#FB7185'],
  ['#34D399', '#22D3EE'],
  ['#FBBF24', '#F87171'],
  ['#A78BFA', '#60A5FA'],
  ['#F59E0B', '#EF4444'],
  ['#10B981', '#3B82F6'],
  ['#EC4899', '#8B5CF6'],
];

export function Avatar({ name, url, size = 40, className = '' }: Props) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [a, b] = PALETTE[h % PALETTE.length];
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: `linear-gradient(135deg, ${a}, ${b})`,
    fontSize: size * 0.42,
  };
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
    >
      {initial}
    </div>
  );
}
