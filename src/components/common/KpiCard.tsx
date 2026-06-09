import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  suffix?: string;
  prefix?: string;
  color?: 'primary' | 'accent' | 'blue' | 'purple';
  isMoney?: boolean;
}

const colorMap = {
  primary: 'bg-primary-50 text-primary-600',
  accent: 'bg-accent-50 text-accent-600',
  blue: 'bg-blue-50 text-blue-600',
  purple: 'bg-purple-50 text-purple-600',
};

export default function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  suffix,
  prefix,
  color = 'primary',
  isMoney = false,
}: KpiCardProps) {
  const displayValue = isMoney ? formatMoney(value as number) : value;

  return (
    <div className="card p-5 h-32 flex flex-col justify-between animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
          <span className="text-2xl font-bold text-slate-800">{displayValue}</span>
          {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                trend >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend >= 0 ? '+' : ''}
              {(trend * 100).toFixed(1)}%
            </span>
            {trendLabel && <span className="text-xs text-slate-400 ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
