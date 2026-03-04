interface Props {
  name: string;
  avatar_url?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function PlayerAvatar({ name, avatar_url, size = 'md' }: Props) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  };

  if (avatar_url) {
    return (
      <img
        src={avatar_url}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-zinc-700`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-pickle/20 text-pickle border-2 border-pickle/30 flex items-center justify-center font-semibold`}
    >
      {initials}
    </div>
  );
}
