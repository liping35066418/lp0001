import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  LayoutDashboard,
  AlertTriangle,
  Clock,
  X,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  RoomCard,
  type RoomSessionInfo,
  type RoomReservationInfo,
} from '@/components/dashboard/RoomCard';
import { ReservationTable } from '@/components/dashboard/ReservationTable';
import { QuickStartModal } from '@/components/dashboard/QuickStartModal';
import type { Reports, Room, Session, Reservation } from '../../shared/api-types';
import { cn } from '@/lib/utils';

interface ReminderItem {
  id: string;
  text: string;
  type: 'overtime' | 'upcoming';
}

function buildSessionInfo(s: Session.Session): RoomSessionInfo {
  const totalMinutes = dayjs(s.scheduledEndAt).diff(dayjs(s.startAt), 'minute');
  const remainingMinutes = dayjs(s.scheduledEndAt).diff(dayjs(), 'minute');
  const elapsedMinutes = dayjs().diff(dayjs(s.startAt), 'minute');
  return {
    sessionId: s.id,
    customerName: s.customerName || '未命名顾客',
    peopleCount: s.peopleCount,
    startAt: s.startAt,
    scheduledEndAt: s.scheduledEndAt,
    elapsedMinutes: Math.max(0, elapsedMinutes),
    totalMinutes: Math.max(1, totalMinutes),
    remainingMinutes,
    consumedAmount: s.totalAmount,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { pushToast } = useUIStore();

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<Reports.OverviewData | null>(null);
  const [rooms, setRooms] = useState<Room.RoomStatus[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session.Session[]>([]);
  const [todayReservations, setTodayReservations] = useState<Reservation.Reservation[]>([]);
  const [sessionInfoMap, setSessionInfoMap] = useState<Record<number, RoomSessionInfo>>({});
  const [reservationInfoMap, setReservationInfoMap] = useState<Record<number, RoomReservationInfo>>({});
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [quickStartRoom, setQuickStartRoom] = useState<Room.RoomStatus | null>(null);

  const [tick, setTick] = useState(0);

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    try {
      const [ov, rs, ss, rvs] = await Promise.all([
        get<Reports.OverviewData>('/dashboard/overview'),
        get<Room.RoomStatus[]>('/dashboard/room-status'),
        get<Session.Session[]>('/sessions/active'),
        get<Reservation.Reservation[]>('/dashboard/today-reservations'),
      ]);
      setOverview(ov);
      setRooms(rs);
      setActiveSessions(ss);
      setTodayReservations(rvs);

      const sim: Record<number, RoomSessionInfo> = {};
      ss.forEach((s) => {
        sim[s.roomId] = buildSessionInfo(s);
      });
      setSessionInfoMap(sim);

      const rim: Record<number, RoomReservationInfo> = {};
      rs.forEach((r) => {
        if (r.currentState === 'reserved') {
          const pending = rvs.find(
            (rv) =>
              rv.roomId === r.id &&
              rv.status === 'pending' &&
              dayjs(rv.startAt).isAfter(dayjs().subtract(1, 'hour'))
          );
          if (pending) {
            rim[r.id] = {
              reservationId: pending.id,
              customerName: pending.customerName,
              customerPhone: pending.customerPhone,
              startAt: pending.startAt,
              peopleCount: pending.peopleCount,
            };
          }
        }
      });
      setReservationInfoMap(rim);

      const newReminders: ReminderItem[] = [];
      ss.forEach((s) => {
        const remain = dayjs(s.scheduledEndAt).diff(dayjs(), 'minute');
        if (remain < 0) {
          newReminders.push({
            id: `overtime-${s.id}`,
            text: `⚠️ ${s.roomName || `包厢#${s.roomId}`}已超时${Math.abs(remain)}分钟，请及时处理`,
            type: 'overtime',
          });
        }
      });
      rvs.forEach((rv) => {
        if (rv.status === 'pending') {
          const diff = dayjs(rv.startAt).diff(dayjs(), 'minute');
          if (diff > 0 && diff <= 30) {
            newReminders.push({
              id: `upcoming-${rv.id}`,
              text: `🕒 ${dayjs(rv.startAt).format('HH:mm')} ${rv.roomName || '包厢'}预约即将到店（${rv.customerName}）`,
              type: 'upcoming',
            });
          }
        }
      });
      setReminders(newReminders);
    } catch (e) {
      pushToast((e as Error).message || '加载数据失败', 'error');
    } finally {
      setLoadingOverview(false);
      setLoadingRooms(false);
      setLoadingReservations(false);
      if (showLoading) setRefreshing(false);
    }
  }, [pushToast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeSessions.length === 0) return;
    setSessionInfoMap((prev) => {
      const next: Record<number, RoomSessionInfo> = {};
      activeSessions.forEach((s) => {
        const cached = prev[s.roomId];
        const totalMinutes =
          cached?.totalMinutes || dayjs(s.scheduledEndAt).diff(dayjs(s.startAt), 'minute');
        const remainingMinutes = dayjs(s.scheduledEndAt).diff(dayjs(), 'minute');
        const elapsedMinutes = dayjs().diff(dayjs(s.startAt), 'minute');
        next[s.roomId] = {
          sessionId: s.id,
          customerName: s.customerName || '未命名顾客',
          peopleCount: s.peopleCount,
          startAt: s.startAt,
          scheduledEndAt: s.scheduledEndAt,
          elapsedMinutes: Math.max(0, elapsedMinutes),
          totalMinutes: Math.max(1, totalMinutes),
          remainingMinutes,
          consumedAmount: s.totalAmount,
        };
      });
      return next;
    });

    setReminders((prev) => {
      const newReminders: ReminderItem[] = [];
      activeSessions.forEach((s) => {
        const remain = dayjs(s.scheduledEndAt).diff(dayjs(), 'minute');
        if (remain < 0) {
          newReminders.push({
            id: `overtime-${s.id}`,
            text: `⚠️ ${s.roomName || `包厢#${s.roomId}`}已超时${Math.abs(remain)}分钟，请及时处理`,
            type: 'overtime',
          });
        }
      });
      todayReservations.forEach((rv) => {
        if (rv.status === 'pending') {
          const diff = dayjs(rv.startAt).diff(dayjs(), 'minute');
          if (diff > 0 && diff <= 30) {
            newReminders.push({
              id: `upcoming-${rv.id}`,
              text: `🕒 ${dayjs(rv.startAt).format('HH:mm')} ${rv.roomName || '包厢'}预约即将到店（${rv.customerName}）`,
              type: 'upcoming',
            });
          }
        }
      });
      const existingIds = new Set(prev.map((p) => p.id));
      const newIds = new Set(newReminders.map((n) => n.id));
      if (existingIds.size !== newIds.size || [...existingIds].some((id) => !newIds.has(id))) {
        return newReminders;
      }
      return prev;
    });
  }, [tick, activeSessions, todayReservations]);

  const usedRooms = rooms.filter((r) => r.currentState === 'in_use').length;
  const totalRooms = rooms.filter((r) => r.status !== 'disabled').length;
  const pendingReservations = todayReservations.filter((r) => r.status === 'pending').length;
  const overtimeCount = reminders.filter((r) => r.type === 'overtime').length;
  const upcomingCount = reminders.filter((r) => r.type === 'upcoming').length;

  const handleQuickStart = (room: Room.RoomStatus) => {
    setQuickStartRoom(room);
  };

  const handleConfirmQuickStart = async (data: {
    roomId: number;
    peopleCount: number;
    hours: number;
  }) => {
    try {
      await post<Session.Session>('/sessions', data);
      pushToast('开台成功', 'success');
      await fetchAll();
    } catch (e) {
      pushToast((e as Error).message || '开台失败', 'error');
      throw e;
    }
  };

  const handleExtend = async (sessionId: number) => {
    try {
      await post(`/sessions/${sessionId}/extend`, { addHours: 1 });
      pushToast('续单1小时成功', 'success');
      await fetchAll();
    } catch (e) {
      pushToast((e as Error).message || '续单失败', 'error');
    }
  };

  const handleCheckout = (sessionId: number) => {
    navigate(`/checkout/${sessionId}`);
  };

  const handleOpenReservation = (room: Room.RoomStatus, rv: RoomReservationInfo) => {
    setQuickStartRoom(room);
  };

  const handleCancelReservation = async (reservationId: number) => {
    try {
      await post(`/reservations/${reservationId}/cancel`, {});
      pushToast('预约已取消', 'success');
      await fetchAll();
    } catch (e) {
      pushToast((e as Error).message || '取消失败', 'error');
      throw e;
    }
  };

  const handleStartFromReservation = async (rv: Reservation.Reservation) => {
    try {
      const hours = Math.max(
        1,
        dayjs(rv.endAt).diff(dayjs(rv.startAt), 'hour') || 2
      );
      await post<Session.Session>('/sessions', {
        roomId: rv.roomId,
        reservationId: rv.id,
        customerName: rv.customerName,
        customerPhone: rv.customerPhone,
        peopleCount: rv.peopleCount,
        hours,
      });
      pushToast('开台成功', 'success');
      await fetchAll();
    } catch (e) {
      pushToast((e as Error).message || '开台失败', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-primary-600" />
            工作台
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {dayjs().format('YYYY年MM月DD日 dddd')} · 今日经营数据概览
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="btn-outline gap-2"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          {refreshing ? '刷新中...' : '刷新数据'}
        </button>
      </div>

      {reminders.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-red-500 text-white px-5 py-3 shadow-lg">
          <div className="absolute inset-0 bg-red-600/30 animate-pulse" />
          <div className="relative flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <div className="inline-block animate-[marquee_30s_linear_infinite]">
                {[...reminders, ...reminders].map((r, i) => (
                  <span key={`${r.id}-${i}`} className="mx-8 font-medium">
                    {r.text}
                  </span>
                ))}
              </div>
            </div>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full shrink-0">
              {reminders.length}条提醒
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingOverview || !overview
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5 h-[120px] animate-pulse-soft bg-gradient-to-br from-slate-100 to-slate-200">
                <div className="h-4 bg-white/60 rounded w-24 mb-3" />
                <div className="h-8 bg-white/60 rounded w-32 mb-2" />
                <div className="h-3 bg-white/60 rounded w-20" />
              </div>
            ))
          : [
              <StatCard key="revenue" type="revenue" data={overview} />,
              <StatCard
                key="rooms"
                type="rooms"
                data={overview}
                totalRooms={totalRooms}
                usedRooms={usedRooms}
              />,
              <StatCard
                key="reservations"
                type="reservations"
                data={overview}
                pendingReservations={pendingReservations}
              />,
              <StatCard
                key="reminders"
                type="reminders"
                data={overview}
                overtimeCount={overtimeCount}
                upcomingCount={upcomingCount}
              />,
            ]}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            包厢实时状态
          </h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                空闲
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-accent-500" />
                使用中
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-sky-500" />
                预约
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-400" />
                维修
              </span>
            </div>
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="text-slate-500 hover:text-primary-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
              title="刷新包厢状态"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {loadingRooms ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[180px] rounded-xl bg-slate-100 animate-pulse-soft"
                />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin opacity-50" />
              <p>暂无包厢数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  sessionInfo={sessionInfoMap[room.id]}
                  reservationInfo={reservationInfoMap[room.id]}
                  onQuickStart={handleQuickStart}
                  onExtend={handleExtend}
                  onCheckout={handleCheckout}
                  onOpenReservation={handleOpenReservation}
                  onCancelReservation={handleCancelReservation}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ReservationTable
        reservations={todayReservations}
        loading={loadingReservations}
        onStartSession={handleStartFromReservation}
        onCancel={handleCancelReservation}
      />

      {quickStartRoom && (
        <QuickStartModal
          room={quickStartRoom}
          onClose={() => setQuickStartRoom(null)}
          onConfirm={handleConfirmQuickStart}
        />
      )}
    </div>
  );
}
