import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, List, CalendarDays } from 'lucide-react';
import dayjs from 'dayjs';
import { get, put, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Reservation, Room, PagedResult } from '../../shared/api-types';
import { cn } from '@/lib/utils';
import ReservationFilter, {
  FilterState,
  todayStr,
} from '@/components/reservation/ReservationFilter';
import ReservationTable from '@/components/reservation/ReservationTable';
import ReservationCalendar from '@/components/reservation/ReservationCalendar';
import ReservationDetailModal from '@/components/reservation/ReservationDetailModal';

type ViewMode = 'list' | 'calendar';

export default function ReservationList() {
  const navigate = useNavigate();
  const pushToast = useUIStore((s) => s.pushToast);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [rooms, setRooms] = useState<Room.Room[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    date: todayStr(),
    roomId: '',
    status: '',
    keyword: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagedData, setPagedData] = useState<PagedResult<Reservation.Reservation>>({
    list: [],
    total: 0,
    page: 1,
    pageSize: 10,
  });

  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    data: Reservation.Reservation | null;
  }>({ open: false, data: null });

  const roomsMap = useMemo(() => {
    const map: Record<number, { name: string; spec: string }> = {};
    rooms.forEach((r) => {
      map[r.id] = { name: r.name, spec: r.spec };
    });
    return map;
  }, [rooms]);

  const fetchRooms = useCallback(async () => {
    try {
      const list = await get<Room.Room[]>('/rooms');
      setRooms(list.filter((r) => r.status !== 'disabled'));
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  }, [pushToast]);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date) {
        params.set('date', filters.date);
      }
      if (filters.roomId !== '') {
        params.set('roomId', String(filters.roomId));
      }
      if (filters.status) {
        params.set('status', filters.status);
      }
      if (filters.keyword) {
        params.set('keyword', filters.keyword);
      }
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const data = await get<PagedResult<Reservation.Reservation>>(
        `/reservations?${params.toString()}`
      );
      setPagedData(data);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, pushToast]);

  const fetchAllForCalendar = useCallback(async (): Promise<
    Reservation.Reservation[]
  > => {
    try {
      const params = new URLSearchParams();
      params.set('date', filters.date);
      if (filters.roomId !== '') {
        params.set('roomId', String(filters.roomId));
      }
      return await get<Reservation.Reservation[]>(
        `/reservations/all?${params.toString()}`
      );
    } catch (e) {
      pushToast((e as Error).message, 'error');
      return [];
    }
  }, [filters.date, filters.roomId, pushToast]);

  const [calendarData, setCalendarData] = useState<Reservation.Reservation[]>(
    []
  );

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchReservations();
    } else {
      fetchAllForCalendar().then(setCalendarData);
    }
  }, [viewMode, fetchReservations, fetchAllForCalendar]);

  const handleReset = () => {
    setFilters({
      date: todayStr(),
      roomId: '',
      status: '',
      keyword: '',
    });
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    fetchReservations();
  };

  const handlePageChange = (p: number, ps: number) => {
    setPage(p);
    setPageSize(ps);
  };

  const handleCalendarDateChange = (d: string) => {
    setFilters({ ...filters, date: d });
  };

  const handleView = (r: Reservation.Reservation) => {
    setDetailModal({ open: true, data: r });
  };

  const handleEdit = (r: Reservation.Reservation) => {
    navigate(`/reservations/new?id=${r.id}`);
  };

  const handleCancel = async (r: Reservation.Reservation) => {
    if (!confirm(`确定要取消顾客「${r.customerName}」的预约吗？`)) return;
    try {
      await put(`/reservations/${r.id}/cancel`);
      pushToast('预约已取消', 'success');
      setDetailModal({ open: false, data: null });
      if (viewMode === 'list') fetchReservations();
      else setCalendarData(await fetchAllForCalendar());
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  const handleCheckIn = async (r: Reservation.Reservation) => {
    try {
      if (r.status === 'checked_in' && r.sessionId) {
        navigate('/sessions');
        return;
      }
      const result = await post<{ reservation: Reservation.Reservation; session: { id: number } }>(
        `/reservations/${r.id}/check-in`
      );
      pushToast('开台成功！', 'success');
      navigate('/sessions');
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  const handleCalendarSlotClick = (roomId: number, startAt: string) => {
    const d = dayjs(startAt);
    const params = new URLSearchParams();
    params.set('roomId', String(roomId));
    params.set('date', d.format('YYYY-MM-DD'));
    params.set('time', d.format('HH:mm'));
    navigate(`/reservations/new?${params.toString()}`);
  };

  const currentRoomInfo = detailModal.data
    ? roomsMap[detailModal.data.roomId]
    : undefined;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">预约管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            查看和管理顾客预约 · 共 {pagedData.total || calendarData.length} 条记录
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'btn-sm flex items-center gap-1.5',
                viewMode === 'list'
                  ? 'bg-white shadow-sm text-primary-600 font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              <List size={15} />
              列表
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'btn-sm flex items-center gap-1.5',
                viewMode === 'calendar'
                  ? 'bg-white shadow-sm text-primary-600 font-medium'
                  : 'text-slate-600 hover:text-slate-800'
              )}
            >
              <CalendarDays size={15} />
              日历
            </button>
          </div>
          <button
            className="btn-primary"
            onClick={() => navigate('/reservations/new')}
          >
            <Plus size={16} />
            新增预约
          </button>
        </div>
      </div>

      <ReservationFilter
        filters={filters}
        rooms={rooms}
        onChange={setFilters}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {loading && viewMode === 'list' ? (
        <LoadingCard />
      ) : viewMode === 'list' ? (
        <ReservationTable
          data={pagedData}
          roomsMap={roomsMap}
          onPageChange={handlePageChange}
          onView={handleView}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onCheckIn={handleCheckIn}
        />
      ) : (
        <ReservationCalendar
          date={filters.date}
          rooms={rooms}
          reservations={calendarData}
          onDateChange={handleCalendarDateChange}
          onSlotClick={handleCalendarSlotClick}
          onReservationClick={handleView}
        />
      )}

      <ReservationDetailModal
        open={detailModal.open}
        reservation={detailModal.data}
        roomInfo={currentRoomInfo}
        onClose={() => setDetailModal({ open: false, data: null })}
        onEdit={handleEdit}
        onCancel={handleCancel}
        onCheckIn={handleCheckIn}
      />
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="card p-6">
      <div className="space-y-3 animate-pulse-soft">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-slate-100 rounded w-8" />
            <div className="h-4 bg-slate-100 rounded w-32" />
            <div className="h-4 bg-slate-100 rounded w-24" />
            <div className="h-4 bg-slate-100 rounded flex-1" />
            <div className="h-4 bg-slate-100 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
