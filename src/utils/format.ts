import dayjs from 'dayjs';
import type { Boardgame, Room, Bill } from '../../shared/api-types';

export function formatMoney(n: number | string | null | undefined): string {
  const num = Number(n || 0);
  return `￥${num.toFixed(2)}`;
}

export function formatMinutes(min: number | string | null | undefined): string {
  const m = Number(min || 0);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h === 0) return `${rm}分`;
  if (rm === 0) return `${h}小时`;
  return `${h}小时${rm}分`;
}

export function formatDate(
  ts: string | number | Date | null | undefined,
  fmt = 'YYYY-MM-DD'
): string {
  if (!ts) return '-';
  return dayjs(ts).format(fmt);
}

export function formatDateTime(ts: string | number | Date | null | undefined): string {
  return formatDate(ts, 'YYYY-MM-DD HH:mm');
}

export function todayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function cnDifficulty(e: Boardgame.Difficulty): string {
  const map: Record<Boardgame.Difficulty, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难',
    expert: '专家',
  };
  return map[e] || e;
}

export function cnSpec(s: Room.Spec): string {
  const map: Record<Room.Spec, string> = {
    small: '小包',
    medium: '中包',
    large: '大包',
    vip: 'VIP',
  };
  return map[s] || s;
}

export function cnStatusPay(m: Bill.PayMethod): string {
  const map: Record<Bill.PayMethod, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    member: '会员卡',
    mixed: '混合',
  };
  return map[m] || m;
}

export function difficultyColor(e: Boardgame.Difficulty): string {
  const map: Record<Boardgame.Difficulty, string> = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-orange-100 text-orange-700',
    expert: 'bg-red-100 text-red-700',
  };
  return map[e] || 'bg-slate-100 text-slate-700';
}

export function specColor(s: Room.Spec): string {
  const map: Record<Room.Spec, string> = {
    small: 'bg-sky-100 text-sky-700',
    medium: 'bg-indigo-100 text-indigo-700',
    large: 'bg-purple-100 text-purple-700',
    vip: 'bg-accent-100 text-accent-700',
  };
  return map[s] || 'bg-slate-100 text-slate-700';
}
