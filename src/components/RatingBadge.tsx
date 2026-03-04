import { getSkillLevel } from '../types';

export function RatingBadge({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const level = getSkillLevel(rating);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${level.color}20`,
        color: level.color,
        border: `1px solid ${level.color}40`,
      }}
    >
      {rating.toFixed(1)}
    </span>
  );
}
