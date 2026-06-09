import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Period = 'today' | 'week' | 'month' | 'custom';

interface PeriodSelectorProps {
  value: Period;
  onChange: (p: Period) => void;
  customStart?: string;
  customEnd?: string;
  onCustomStartChange?: (v: string) => void;
  onCustomEndChange?: (v: string) => void;
}

const options: { key: Period; label: string }[] = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'custom', label: '自定义' },
];

export default function PeriodSelector({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors',
              value === opt.key
                ? 'bg-white text-primary-700 shadow-sm font-medium'
                : 'text-slate-600 hover:text-slate-800'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange?.(e.target.value)}
            className="input w-auto text-sm"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange?.(e.target.value)}
            className="input w-auto text-sm"
          />
        </div>
      )}
    </div>
  );
}
