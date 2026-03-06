import { getSkillLevel } from '../types';

interface Props {
  label: string;
  value: number;
  max?: number;
}

export function SkillBar({ label, value, max = 5.5 }: Props) {
  const pct = Math.min(100, ((value - 2.0) / (max - 2.0)) * 100);
  const level = getSkillLevel(value);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: level.color }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right" style={{ color: level.color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}
