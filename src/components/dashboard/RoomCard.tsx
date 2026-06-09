import { useMemo, useState } from 'react';
import {
  Play,
  Clock,
  DollarSign,
  Users,
  Wrench,
  CalendarCheck,
  CheckCircle,
  XCircle,
  Timer,
  Receipt,
} from 'lucide-react';
import type { Room, Session, Reservation } from '../../../shared/api-types';
import { cnSpec, formatMoney, formatMinutes, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

export interface RoomSessionInfo {
  sessionId: number;
  customerName: string;
  peopleCount: number;
  startAt: string;
  scheduledEndAt: string;
  elapsedMinutes: number;
  totalMinutes: number;
  remainingMinutes: number;
  consumedAmount: number;
}

export interface RoomReservationInfo {
  reservationId: number;
  customerName: string;
  customerPhone: string;
  startAt: string;
  peopleCount: number;
}

interface RoomCardProps {
  room: Room.RoomStatus;
  sessionInfo?: RoomSessionInfo;
  reservationInfo?: RoomReservationInfo;
  onQuickStart: (room: Room.RoomStatus) => void;
  onExtend: (sessionId: number) => void;
  onCheckout: (sessionId: number) => void;
  onOpenReservation: (room: Room.RoomStatus, reservation: RoomReservationInfo) => void;
  onCancelReservation: (reservationId: number) => Promise<void>;
}

const stateConfig = {
  idle: {
    badgeText: '空闲',
    badgeClass: 'bg-green-100 text-green-700',
    borderClass: 'border-slate-200 hover:border-primary-300',
    bgClass: 'bg-green-50/50',
  },
  in_use: {
    badgeText: '使用中',
    badgeClass: 'bg-accent-100 text-accent-700',
    borderClass: 'border-accent-300 shadow-accent-100 shadow-md',
    bgClass: 'bg-accent-50/30',
  },
  reserved: {
    badgeText: '已预约',
    badgeClass: 'bg-sky-100 text-sky-700',
    borderClass: 'border-sky-300',
    bgClass: 'bg-sky-50/30',
  },
  maintenance: {
    badgeText: '维护中',
    badgeClass: 'bg-slate-100 text-slate-500',
    borderClass: 'border-slate-200 opacity-60',
    bgClass: 'bg-slate-50',
  },
} as const;

export function RoomCard({
  room,
  sessionInfo,
  reservationInfo,
  onQuickStart,
  onExtend,
  onCheckout,
  onOpenReservation,
  onCancelReservation,
}: RoomCardProps) {
  const cfg = stateConfig[room.currentState];

  const progressData = useMemo(() => {
    if (!sessionInfo) return null;
    const { totalMinutes, remainingMinutes, elapsedMinutes } = sessionInfo;
    const total = totalMinutes > 0 ? totalMinutes : Math.max(1, elapsedMinutes + remainingMinutes);
    const used = Math.min(elapsedMinutes, total);
    const percent = total > 0 ? (used / total) * 100 : 0;
    const remainingPercent = Math.max(0, 100 - percent);
    const isOvertime = remainingMinutes <= 0;
    const isLow = !isOvertime && remainingPercent < 15;
    return { percent, remainingPercent, isOvertime, isLow };
  }, [sessionInfo]);

  const [canceling, setCanceling] = useState(false);

  const handleCancel = async () => {
    if (!reservationInfo) return;
    setCanceling(true);
    try {
      await onCancelReservation(reservationInfo.reservationId);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div
      className={cn(
        'card rounded-xl border-2 transition-all duration-200 overflow-hidden h-[180px] flex flex-col',
        cfg.borderClass
      )}
    >
      <div className={cn('px-4 py-2.5 flex items-center justify-between', cfg.bgClass)}>
        <div className="flex items-center gap-2">
          <span className={cn('badge', cfg.badgeClass)}>{cfg.badgeText}</span>
          <span className="font-bold text-slate-800">{room.name}</span>
          <span className="text-xs text-slate-500">{cnSpec(room.spec)}</span>
        </div>
      </div>

      <div className="flex-1 px-4 py-3 flex flex-col justify-center min-h-0">
        {room.currentState === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-green-600">
            <DollarSign className="w-8 h-8 mb-1 opacity-70" />
            <p className="text-2xl font-bold">{formatMoney(room.basePrice)}</p>
            <p className="text-xs text-slate-500 mt-0.5">每小时 · 容纳{room.capacity}人</p>
          </div>
        )}

        {room.currentState === 'in_use' && sessionInfo && (
          <div className="space-y-2 w-full">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-slate-700 min-w-0">
                <Users className="w-4 h-4 shrink-0 text-accent-600" />
                <span className="font-medium truncate">{sessionInfo.customerName || '未命名'}</span>
                <span className="text-slate-400">({sessionInfo.peopleCount}人)</span>
              </div>
              <div className="flex items-center gap-1 text-slate-600 shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-accent-600" />
                <span className="font-semibold text-accent-700">{formatMoney(sessionInfo.consumedAmount)}</span>
              </div>
            </div>

            {progressData && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    已用 {formatMinutes(sessionInfo.elapsedMinutes)}
                  </span>
                  <span className={cn(
                    'font-medium flex items-center gap-1',
                    progressData.isOvertime ? 'text-red-600 animate-pulse' :
                    progressData.isLow ? 'text-red-500' : 'text-slate-500'
                  )}>
                    <Timer className="w-3 h-3" />
                    {progressData.isOvertime
                      ? `超时 ${formatMinutes(-sessionInfo.remainingMinutes)}`
                      : `剩 ${formatMinutes(sessionInfo.remainingMinutes)}`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      progressData.isOvertime ? 'bg-red-500' :
                      progressData.isLow ? 'bg-red-400' : 'bg-accent-500'
                    )}
                    style={{
                      width: progressData.isOvertime
                        ? '100%'
                        : `${Math.min(100, progressData.percent)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {room.currentState === 'reserved' && reservationInfo && (
          <div className="space-y-2 w-full">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Users className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="font-medium">{reservationInfo.customerName}</span>
              <span className="text-slate-400 text-xs">({reservationInfo.peopleCount}人)</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-sky-600">
              <CalendarCheck className="w-4 h-4 shrink-0" />
              <span className="font-medium">{formatDate(reservationInfo.startAt, 'HH:mm')} 到店</span>
            </div>
            <div className="text-xs text-slate-500 truncate">{reservationInfo.customerPhone}</div>
          </div>
        )}

        {room.currentState === 'maintenance' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Wrench className="w-10 h-10 mb-2 opacity-60" />
            <p className="text-sm">维护中</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-2">
        {room.currentState === 'idle' && (
          <button
            onClick={() => onQuickStart(room)}
            className="btn-primary btn-sm flex-1"
          >
            <Play className="w-3.5 h-3.5" />
            快速开台
          </button>
        )}

        {room.currentState === 'in_use' && sessionInfo && (
          <>
            <button
              onClick={() => onExtend(sessionInfo.sessionId)}
              className="btn-outline btn-sm flex-1"
            >
              <Clock className="w-3.5 h-3.5" />
              续单
            </button>
            <button
              onClick={() => onCheckout(sessionInfo.sessionId)}
              className="btn-accent btn-sm flex-1"
            >
              <Receipt className="w-3.5 h-3.5" />
              结账
            </button>
          </>
        )}

        {room.currentState === 'reserved' && reservationInfo && (
          <>
            <button
              onClick={() => onOpenReservation(room, reservationInfo)}
              className="btn-primary btn-sm flex-1"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              开台
            </button>
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="btn-outline btn-sm flex-1 text-red-600 hover:bg-red-50 border-red-200"
            >
              <XCircle className="w-3.5 h-3.5" />
              {canceling ? '取消中...' : '取消'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
