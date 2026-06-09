import { Search, RotateCcw, Filter } from 'lucide-react';
import type { Room } from '../../../shared/api-types';
import { cn } from '@/lib/utils';

export interface FilterState {
  date: string;
  roomId: number | '';
  status: string;
  keyword: string;
}

interface Props {
  filters: FilterState;
  rooms: Room.Room[];
  onChange: (f: FilterState) => void;
  onSearch: () => void;
  onReset: () => void;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待确认' },
  { value: 'checked_in', label: '已到店' },
  { value: 'cancelled', label: '已取消' },
  { value: 'no_show', label: '爽约' },
];

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function ReservationFilter({
  filters,
  rooms,
  onChange,
  onSearch,
  onReset,
  className,
}: Props) {
  return (
    <div className={cn('card p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Filter size={16} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">筛选条件</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="label">预约日期</label>
          <input
            type="date"
            className="input"
            value={filters.date}
            onChange={(e) => onChange({ ...filters, date: e.target.value })}
          />
        </div>
        <div>
          <label className="label">包厢</label>
          <select
            className="input"
            value={filters.roomId}
            onChange={(e) =>
              onChange({
                ...filters,
                roomId: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          >
            <option value="">全部</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">状态</label>
          <select
            className="input"
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">搜索顾客</label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              className="input pl-9"
              placeholder="姓名 / 电话"
              value={filters.keyword}
              onChange={(e) => onChange({ ...filters, keyword: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="btn-outline flex-1"
            onClick={onReset}
          >
            <RotateCcw size={16} />
            重置
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={onSearch}
          >
            查询
          </button>
        </div>
      </div>
    </div>
  );
}
