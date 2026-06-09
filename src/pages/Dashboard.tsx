import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  LayoutDashboard,
  AlertTriangle,
  Clock,
  X,
  Loader2,
  Users,
  Plus,
  ListOrdered,
  MessageSquare,
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
import JoinQueueModal from '@/components/dashboard/JoinQueueModal';
import QueueManagementPanel from '@/components/dashboard/QueueManagementPanel';
import CallingNotification from '@/components/dashboard/CallingNotification';
import OvertimeReminderModal from '@/components/session/OvertimeReminderModal';
import type { Reports, Room, Session, Reservation, Queue as Q } from '../../shared/api-types';
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

  const [queueData, setQueueData] = useState<Q.QueueSummary | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [showJoinQueue, setShowJoinQueue] = useState(false);
  const [callingItem, setCallingItem] = useState<Q.WaitingItem | null>(null);
  const [showQueueTab, setShowQueueTab] = useState(false);

  const [dismissedOvertime, setDismissedOvertime] = useState<Set<string>>(new Set());
  const [overtimeReminder, setOvertimeReminder] = useState<{
    info: RoomSessionInfo;
    roomName: string;
    basePrice: number;
    key: string;
  } | null>(null);
  const [notifiedCallingIds, setNotifiedCallingIds] = useState<Set<number>>(new Set());

  const fetchQueue = useCallback(async () => {
    try {
      const data = await get<Q.QueueSummary>('/queue/summary');
      setQueueData(data);
      const calling = data.list.find((i) => i.status === 'calling');
      if (calling && !notifiedCallingIds.has(calling.id)) {
        setCallingItem(calling);
        setNotifiedCallingIds((s) => new Set([...s, calling.id]));
        pushToast(
          `叫号通知：#${calling.queueNumber} ${calling.customerName} 请前往${calling.assignedRoomName || '前台'}`,
          'success',
        );
      }
    } catch (e) {
      // ignore silently
    }
  }, [pushToast, notifiedCallingIds]);

  const fetchAll = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    setLoadingQueue(true);
    try {
      const [ov, rs, ss, rvs, qs] = await Promise.all([
        get<Reports.OverviewData>('/dashboard/overview'),
        get<Room.RoomStatus[]>('/dashboard/room-status'),
        get<Session.Session[]>('/sessions/active'),
        get<Reservation.Reservation[]>('/dashboard/today-reservations'),
        get<Q.QueueSummary>('/queue/summary').catch(() => null),
      ]);
      setOverview(ov);
      setRooms(rs);
      setActiveSessions(ss);
      setTodayReservations(rvs);
      if (qs) {
        setQueueData(qs);
        const calling = qs.list.find((i) => i.status === 'calling');
        if (calling && !notifiedCallingIds.has(calling.id)) {
          setCallingItem(calling);
          setNotifiedCallingIds((s) => new Set([...s, calling.id]));
          pushToast(
            `叫号通知：#${calling.queueNumber} ${calling.customerName}`,
            'success',
          );
        }
      }

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
      setLoadingQueue(false);
      if (showLoading) setRefreshing(false);
    }
  }, [pushToast, notifiedCallingIds]);

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

        if (remainingMinutes < 0) {
          const abs = Math.abs(remainingMinutes);
          const slot = Math.floor(abs / 15);
          const key = `${s.id}-${slot}`;
          const roomInfo = rooms.find((r) => r.id === s.roomId);
          if (
            slot >= 1 &&
            !dismissedOvertime.has(key) &&
            (!overtimeReminder || overtimeReminder.key !== key)
          ) {
            setOvertimeReminder({
              info: next[s.roomId],
              roomName: s.roomName || roomInfo?.name || `包厢#${s.roomId}`,
              basePrice: roomInfo?.basePrice || 50,
              key,
            });
          }
        }
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

    fetchQueue();
  }, [tick, activeSessions, todayReservations, rooms, fetchQueue, dismissedOvertime, overtimeReminder]);

  const usedRooms = rooms.filter((r) => r.currentState === 'in_use').length;
  const totalRooms = rooms.filter((r) => r.status !== 'disabled').length;
  const availableRooms = totalRooms - usedRooms - rooms.filter((r) => r.currentState === 'maintenance').length;
  const allRoomsFull = availableRooms <= 0 && totalRooms > 0;
  const pendingReservations = todayReservations.filter((r) => r.status === 'pending').length;
  const overtimeCount = reminders.filter((r) => r.type === 'overtime').length;
  const upcomingCount = reminders.filter((r) => r.type === 'upcoming').length;
  const waitingCount = queueData?.waitingCount || 0;
  const callingCount = queueData?.callingCount || 0;
  const totalActiveQueue = waitingCount + callingCount;

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
      await post<{ reservation: Reservation.Reservation; session: { id: number } }>(
        `/reservations/${rv.id}/check-in`
      );
      pushToast('开台成功', 'success');
      navigate('/sessions');
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

      <div className="flex items-center gap-2 border-b border-slate-200 -mb-2">
        <button
          onClick={() => setShowQueueTab(false)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-1.5',
            !showQueueTab
              ? 'border-primary-500 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <Clock className="w-4 h-4" />
          包厢实时状态
        </button>
        <button
          onClick={() => setShowQueueTab(true)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-1.5 relative',
            showQueueTab
              ? 'border-primary-500 text-primary-700'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <ListOrdered className="w-4 h-4" />
          等位队列管理
          {totalActiveQueue > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-amber-500 text-white">
              {totalActiveQueue}
            </span>
          )}
        </button>
      </div>

      {!showQueueTab ? (
        <>
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-600" />
                  包厢实时状态
                </h3>
                {(allRoomsFull || totalActiveQueue > 0) && (
                  <div className="flex items-center gap-3 pl-3 ml-1 border-l border-slate-200">
                    {allRoomsFull && totalActiveQueue === 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                        <Users className="w-3.5 h-3.5" />
                        包厢已满，建议客人加入等位
                      </span>
                    )}
                    {totalActiveQueue > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500 text-white animate-pulse">
                        <Users className="w-3.5 h-3.5" />
                        当前等位 {waitingCount} 组 · 叫号中 {callingCount} 组
                      </span>
                    )}
                    <button
                      onClick={() => setShowJoinQueue(true)}
                      className="btn-primary btn-sm !py-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      加入等位
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    空闲 {availableRooms}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-accent-500" />
                    使用中 {usedRooms}
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

            {(allRoomsFull || totalActiveQueue > 0) && (
              <div className="mx-5 mt-4 rounded-xl overflow-hidden border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50">
                <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-amber-800 flex items-center gap-2">
                        {allRoomsFull ? '包厢全部满房' : '高峰期提示'}
                        {totalActiveQueue > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 text-amber-700 text-xs border border-amber-200">
                            <MessageSquare className="w-3 h-3" />
                            当前等位 {totalActiveQueue} 组
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {allRoomsFull
                          ? '请引导客人扫码或点击右侧按钮加入等位排队，空出包厢后将按序叫号'
                          : '已有客人等位中，包厢结束后将自动通知第一位等位客人'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowQueueTab(true)}
                      className="btn-outline btn-sm border-amber-400 text-amber-700 hover:bg-amber-50"
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      查看队列
                    </button>
                    <button
                      onClick={() => setShowJoinQueue(true)}
                      className="btn-primary btn-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      加入等位
                    </button>
                  </div>
                </div>
              </div>
            )}

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
        </>
      ) : (
        <QueueManagementPanel
          queueData={queueData}
          loading={loadingQueue && !queueData}
          onRefresh={() => fetchAll(true)}
        />
      )}

      {quickStartRoom && (
        <QuickStartModal
          room={quickStartRoom}
          onClose={() => setQuickStartRoom(null)}
          onConfirm={handleConfirmQuickStart}
        />
      )}

      <JoinQueueModal
        open={showJoinQueue}
        onClose={() => setShowJoinQueue(false)}
        onSuccess={() => fetchAll(true)}
      />

      <CallingNotification
        item={callingItem}
        onClose={() => setCallingItem(null)}
      />

      <OvertimeReminderModal
        sessionInfo={overtimeReminder?.info || null}
        roomName={overtimeReminder?.roomName}
        basePrice={overtimeReminder?.basePrice}
        dismissKey={overtimeReminder?.key || ''}
        onClose={() => setOvertimeReminder(null)}
        onExtendSuccess={() => fetchAll(true)}
        onDismiss={(k) => setDismissedOvertime((s) => new Set([...s, k]))}
      />
    </div>
  );
}
