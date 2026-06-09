import {
  DollarSign,
  Coffee,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import type { Reports } from '../../../shared/api-types';
import { formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

type StatKey = 'revenue' | 'rooms' | 'reservations' | 'reminders';

interface StatCardProps {
  type: StatKey;
  data: Reports.OverviewData;
  totalRooms?: number;
  usedRooms?: number;
  pendingReservations?: number;
  overtimeCount?: number;
  upcomingCount?: number;
}

const config: Record<StatKey, {
  title: string;
  bgGradient: string;
  iconBg: string;
  icon: typeof DollarSign;
  iconColor: string;
  textColor: string;
}> = {
  revenue: {
    title: '今日营收',
    bgGradient: 'from-primary-500 to-primary-700',
    iconBg: 'bg-white/20',
    icon: DollarSign,
    iconColor: 'text-white',
    textColor: 'text-white',
  },
  rooms: {
    title: '在台包厢',
    bgGradient: 'from-accent-400 to-accent-600',
    iconBg: 'bg-white/20',
    icon: Coffee,
    iconColor: 'text-white',
    textColor: 'text-white',
  },
  reservations: {
    title: '今日预约',
    bgGradient: 'from-sky-500 to-sky-700',
    iconBg: 'bg-white/20',
    icon: Clock,
    iconColor: 'text-white',
    textColor: 'text-white',
  },
  reminders: {
    title: '待处理提醒',
    bgGradient: 'from-red-500 to-red-700',
    iconBg: 'bg-white/20',
    icon: AlertTriangle,
    iconColor: 'text-white',
    textColor: 'text-white',
  },
};

function formatPercent(p: number): { value: string; up: boolean; zero: boolean } {
  const v = Number((p * 100).toFixed(1));
  if (v === 0) return { value: '0.0%', up: false, zero: true };
  return { value: `${v > 0 ? '+' : ''}${v}%`, up: v > 0, zero: false };
}

export function StatCard({
  type,
  data,
  totalRooms = 0,
  usedRooms = 0,
  pendingReservations = 0,
  overtimeCount = 0,
  upcomingCount = 0,
}: StatCardProps) {
  const cfg = config[type];
  const Icon = cfg.icon;

  let mainValue: string;
  let subText: string;
  let subIcon: React.ReactNode = null;

  switch (type) {
    case 'revenue': {
      mainValue = formatMoney(data.todayRevenue);
      const pct = formatPercent(data.monthOnMonth);
      subText = `较上月 ${pct.value}`;
      subIcon = pct.zero ? (
        <Minus className="w-4 h-4" />
      ) : pct.up ? (
        <TrendingUp className="w-4 h-4" />
      ) : (
        <TrendingDown className="w-4 h-4" />
      );
      break;
    }
    case 'rooms': {
      mainValue = `${usedRooms}/${totalRooms}`;
      const rate = totalRooms > 0 ? (usedRooms / totalRooms) * 100 : 0;
      subText = `上座率 ${rate.toFixed(0)}%`;
      subIcon = <Coffee className="w-4 h-4" />;
      break;
    }
    case 'reservations': {
      mainValue = `${pendingReservations || 0}`;
      subText = `待开台 ${pendingReservations || 0}`;
      subIcon = <Clock className="w-4 h-4" />;
      break;
    }
    case 'reminders': {
      mainValue = `${overtimeCount + upcomingCount}`;
      subText = `超时${overtimeCount} · 到店${upcomingCount}`;
      subIcon = <AlertTriangle className="w-4 h-4" />;
      break;
    }
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl p-5 bg-gradient-to-br shadow-lg',
        cfg.bgGradient
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
      <div className="relative flex items-start justify-between">
        <div className={cfg.textColor}>
          <p className="text-sm opacity-90 mb-2">{cfg.title}</p>
          <p className="text-3xl font-bold tracking-tight mb-2">{mainValue}</p>
          <div className={cn(
            'flex items-center gap-1.5 text-sm opacity-90',
            type === 'revenue' && 'flex'
          )}>
            {subIcon}
            <span>{subText}</span>
          </div>
        </div>
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          cfg.iconBg,
          cfg.iconColor
        )}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
