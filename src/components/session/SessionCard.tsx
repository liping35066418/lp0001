import { useState, useEffect, useMemo } from 'react';
import {
  User,
  Phone,
  Users,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Gamepad2,
  Clock3,
  RefreshCw,
  CreditCard,
  AlertTriangle,
  Package,
  Dice5,
} from 'lucide-react';
import dayjs from 'dayjs';
import type { Session } from '../../../shared/api-types';
import { formatDateTime, formatMoney, formatMinutes } from '@/utils/format';
import { cn } from '@/lib/utils';

interface Props {
  session: Session.SessionDetail;
  onAddGoods: (s: Session.SessionDetail) => void;
  onRentBoardgame: (s: Session.SessionDetail) => void;
  onExtend: (s: Session.SessionDetail) => void;
  onRefresh: (s: Session.SessionDetail) => void;
  onCheckout: (s: Session.SessionDetail) => void;
}

export default function SessionCard({
  session,
  onAddGoods,
  onRentBoardgame,
  onExtend,
  onRefresh,
  onCheckout,
}: Props) {
  const [now, setNow] = useState(dayjs());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const s = session;
  const startTime = dayjs(s.startAt);
  const scheduledEnd = dayjs(s.scheduledEndAt);
  const elapsed = now.diff(startTime, 'minute');
  const isOvertime = now.isAfter(scheduledEnd);
  const overtimeMinutes = Math.max(0, now.diff(scheduledEnd, 'minute'));

  const elapsedDisplay = useMemo(() => {
    const h = Math.floor(elapsed / 60);
    const m = elapsed % 60;
    const sec = Math.floor((now.valueOf() - startTime.valueOf()) / 1000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [elapsed, now, startTime]);

  const statusBadge = isOvertime ? (
    <span className="badge bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
      <AlertTriangle size={12} />
      已超时 {formatMinutes(overtimeMinutes)}
    </span>
  ) : (
    <span className="badge bg-accent-100 text-accent-700 border border-accent-200 flex items-center gap-1">
      <Clock3 size={12} className="animate-pulse" />
      进行中
    </span>
  );

  const goodsTotal = s.goodsItems.reduce((sum, g) => sum + g.subtotal, 0);
  const rentalsTotal = s.rentals.reduce((sum, r) => sum + r.rentalFee, 0);

  return (
    <div
      className={cn(
        'card-hover overflow-hidden animate-slide-up',
        isOvertime && 'ring-2 ring-red-200'
      )}
    >
      <div
        className={cn(
          'px-5 py-4 flex items-center justify-between border-b border-slate-100',
          isOvertime ? 'bg-red-50' : 'bg-gradient-to-r from-accent-50 to-white'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm',
              isOvertime ? 'bg-red-500' : 'bg-primary-600'
            )}
          >
            {s.roomName?.charAt(0) || 'R'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {s.roomName || `包厢 #${s.roomId}`}
            </h3>
            <div className="text-xs text-slate-500 mt-0.5">
              场次 #{String(s.id).padStart(6, '0')}
            </div>
          </div>
        </div>
        {statusBadge}
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3">
          <InfoBlock title="顾客信息" icon={<User size={14} />}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-slate-600">
                <User size={13} className="text-slate-400" />
                <span className="font-medium text-slate-800">
                  {s.customerName || '散客'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <Phone size={13} className="text-slate-400" />
                <span className="font-mono text-xs">
                  {s.customerPhone || '-'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                <Users size={13} className="text-slate-400" />
                <span>{s.peopleCount} 人在场</span>
              </div>
            </div>
          </InfoBlock>

          <InfoBlock title="时间信息" icon={<Clock size={14} />}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Calendar size={13} className="text-slate-400" />
                  开始时间
                </span>
                <span className="font-medium text-slate-800">
                  {formatDateTime(s.startAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock3 size={13} className="text-slate-400" />
                  已用时
                </span>
                <span
                  className={cn(
                    'font-mono font-bold text-lg tabular-nums',
                    isOvertime ? 'text-red-600' : 'text-primary-600'
                  )}
                >
                  {elapsedDisplay}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock size={13} className="text-slate-400" />
                  预计结束
                </span>
                <span
                  className={cn(
                    'font-medium',
                    isOvertime ? 'text-red-600 line-through' : 'text-slate-800'
                  )}
                >
                  {formatDateTime(s.scheduledEndAt)}
                </span>
              </div>
            </div>
          </InfoBlock>
        </div>

        <div className="space-y-3">
          <InfoBlock title="费用明细" icon={<CreditCard size={14} />}>
            <div className="space-y-1.5 text-sm">
              <FeeRow label="包厢费" value={s.roomFee} />
              <FeeRow
                label="超时费"
                value={s.overtimeFee}
                highlight={isOvertime}
              />
              <FeeRow label="租借费" value={s.rentalFee || rentalsTotal} />
              <FeeRow label="商品费" value={s.goodsFee || goodsTotal} />
              {s.discountAmount > 0 && (
                <FeeRow
                  label="优惠折扣"
                  value={-s.discountAmount}
                  negative
                />
              )}
              <div className="h-px bg-slate-100 my-2" />
              <div className="flex items-end justify-between">
                <span className="text-slate-500">应付金额</span>
                <span className="text-2xl font-bold text-accent-600 tabular-nums">
                  {formatMoney(s.totalAmount)}
                </span>
              </div>
            </div>
          </InfoBlock>
        </div>
      </div>

      {(s.goodsItems.length > 0 || s.rentals.length > 0) && (
        <div className="px-5 border-t border-slate-100">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2.5 flex items-center justify-between text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Package size={14} />
              消费明细
              <span className="badge bg-slate-100 text-slate-600">
                商品 {s.goodsItems.length} · 租借 {s.rentals.length}
              </span>
            </span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {expanded && (
            <div className="pb-4 space-y-4 animate-slide-up">
              {s.goodsItems.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                    <ShoppingCart size={12} />
                    商品明细
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    {s.goodsItems.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700">
                          {g.name}
                          <span className="text-slate-400 mx-1">×</span>
                          <span className="text-slate-500">{g.quantity}</span>
                        </span>
                        <span className="font-medium text-slate-700 tabular-nums">
                          {formatMoney(g.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {s.rentals.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
                    <Dice5 size={12} />
                    租借桌游
                  </h4>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                    {s.rentals.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700 flex items-center gap-2">
                          <Gamepad2 size={13} className="text-slate-400" />
                          {r.boardgameName}
                          <span
                            className={cn(
                              'badge',
                              r.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : r.status === 'returned'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-red-100 text-red-700'
                            )}
                          >
                            {r.status === 'active'
                              ? '使用中'
                              : r.status === 'returned'
                              ? '已归还'
                              : r.status}
                          </span>
                        </span>
                        <span className="font-medium text-slate-700 tabular-nums">
                          {formatMoney(r.rentalFee)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={12} />
          创建于 {formatDateTime(s.createdAt)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn-sm btn-outline"
            onClick={() => onRefresh(s)}
          >
            <RefreshCw size={13} />
            刷新费用
          </button>
          <button
            className="btn-sm btn-outline"
            onClick={() => onAddGoods(s)}
          >
            <ShoppingCart size={13} />
            商品点单
          </button>
          <button
            className="btn-sm btn-outline"
            onClick={() => onRentBoardgame(s)}
          >
            <Gamepad2 size={13} />
            租借桌游
          </button>
          <button
            className="btn-sm btn-accent"
            onClick={() => onExtend(s)}
          >
            <Clock3 size={13} />
            续单
          </button>
          <button
            className="btn-sm btn-primary"
            onClick={() => onCheckout(s)}
          >
            <CreditCard size={13} />
            结账
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <h4 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
        <span className="text-primary-500">{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function FeeRow({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          'tabular-nums font-medium',
          highlight && value > 0 && 'text-red-600',
          negative && value !== 0 && 'text-green-600'
        )}
      >
        {negative && value > 0 ? '-' : ''}
        {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}
