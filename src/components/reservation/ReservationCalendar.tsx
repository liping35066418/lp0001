import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import type { Reservation, Room } from '../../../shared/api-types';
import { cn } from '@/lib/utils';

interface Props {
  date: string;
  rooms: Room.Room[];
  reservations: Reservation.Reservation[];
  onDateChange: (d: string) => void;
  onSlotClick: (roomId: number, startAt: string) => void;
  onReservationClick: (r: Reservation.Reservation) => void;
}

const START_HOUR = 10;
const END_HOUR = 26;
const SLOT_MINUTES = 30;
const CELL_HEIGHT = 40;

function buildTimeSlots(): { label: string; start: dayjs.Dayjs; minutesOfDay: number }[] {
  const slots: { label: string; start: dayjs.Dayjs; minutesOfDay: number }[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const hour24 = h >= 24 ? h - 24 : h;
      const isNextDay = h >= 24;
      const label = `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}${isNextDay ? '+' : ''}`;
      const minutesOfDay = h * 60 + m;
      slots.push({
        label,
        start: dayjs(),
        minutesOfDay,
      });
    }
  }
  return slots;
}

const STATUS_BG: Record<Reservation.Status, string> = {
  pending: 'bg-blue-500',
  checked_in: 'bg-green-500',
  cancelled: 'bg-slate-400',
  no_show: 'bg-red-400',
};

const STATUS_BORDER: Record<Reservation.Status, string> = {
  pending: 'border-blue-600',
  checked_in: 'border-green-600',
  cancelled: 'border-slate-500',
  no_show: 'border-red-500',
};

export default function ReservationCalendar({
  date,
  rooms,
  reservations,
  onDateChange,
  onSlotClick,
  onReservationClick,
}: Props) {
  const slots = useMemo(() => buildTimeSlots(), []);
  const baseDate = dayjs(date);

  const groupedByRoom = useMemo(() => {
    const map: Record<number, Reservation.Reservation[]> = {};
    rooms.forEach((r) => (map[r.id] = []));
    reservations.forEach((r) => {
      if (!map[r.roomId]) map[r.roomId] = [];
      map[r.roomId].push(r);
    });
    return map;
  }, [rooms, reservations]);

  const navPrevDay = () => onDateChange(baseDate.subtract(1, 'day').format('YYYY-MM-DD'));
  const navNextDay = () => onDateChange(baseDate.add(1, 'day').format('YYYY-MM-DD'));
  const navToday = () => onDateChange(dayjs().format('YYYY-MM-DD'));
  const isToday = baseDate.isSame(dayjs(), 'day');

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-primary-600" />
          <span className="font-semibold text-lg text-slate-800">
            {baseDate.format('YYYY年MM月DD日 dddd')}
          </span>
          {isToday && (
            <span className="badge bg-primary-100 text-primary-700">今天</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn-sm btn-ghost"
            onClick={navPrevDay}
            title="前一天"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className={cn('btn-sm', isToday ? 'btn-primary' : 'btn-outline')}
            onClick={navToday}
          >
            今天
          </button>
          <button
            className="btn-sm btn-ghost"
            onClick={navNextDay}
            title="后一天"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-360px)]">
        <div className="min-w-full inline-block">
          <div
            className="grid border-b border-slate-200 bg-slate-50 sticky top-0 z-10"
            style={{
              gridTemplateColumns: `80px repeat(${rooms.length}, 140px)`,
            }}
          >
            <div className="px-2 py-2 text-xs font-medium text-slate-500 border-r border-slate-200">
              时间
            </div>
            {rooms.map((room) => (
              <div
                key={room.id}
                className="px-2 py-2 text-center border-r border-slate-200 last:border-r-0"
              >
                <div className="text-sm font-semibold text-slate-800">
                  {room.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {room.capacity}人 · ￥{room.basePrice}/h
                </div>
              </div>
            ))}
          </div>

          <div className="relative">
            {slots.map((slot, slotIdx) => {
              const isHour = slot.minutesOfDay % 60 === 0;
              return (
                <div
                  key={slotIdx}
                  className={cn(
                    'grid border-b border-slate-100',
                    isHour ? 'bg-white' : 'bg-slate-50/40'
                  )}
                  style={{
                    gridTemplateColumns: `80px repeat(${rooms.length}, 140px)`,
                    height: `${CELL_HEIGHT}px`,
                  }}
                >
                  <div
                    className={cn(
                      'px-2 py-1 text-xs border-r border-slate-100',
                      isHour
                        ? 'text-slate-700 font-medium'
                        : 'text-slate-400'
                    )}
                  >
                    {slot.label}
                  </div>
                  {rooms.map((room, roomIdx) => {
                    const slotStart = baseDate
                      .startOf('day')
                      .add(slot.minutesOfDay, 'minute');
                    const slotEnd = slotStart.add(SLOT_MINUTES, 'minute');

                    const occupyingReservation = (
                      groupedByRoom[room.id] || []
                    ).find((r) => {
                      const rStart = dayjs(r.startAt);
                      const rEnd = dayjs(r.endAt);
                      return slotStart.isBefore(rEnd) && slotEnd.isAfter(rStart);
                    });

                    const isFirstSlotOfReservation =
                      occupyingReservation &&
                      dayjs(occupyingReservation.startAt).isBefore(
                        slotStart.add(SLOT_MINUTES, 'minute')
                      ) &&
                      dayjs(occupyingReservation.startAt).isAfter(
                        slotStart.subtract(1, 'minute')
                      );

                    const borderClass =
                      roomIdx === rooms.length - 1
                        ? ''
                        : 'border-r border-slate-100';

                    if (occupyingReservation) {
                      const r = occupyingReservation;
                      const rStart = dayjs(r.startAt);
                      const rEnd = dayjs(r.endAt);
                      const durationMins = rEnd.diff(rStart, 'minute');
                      const rowsSpan = Math.ceil(durationMins / SLOT_MINUTES);

                      if (isFirstSlotOfReservation) {
                        const topOffset =
                          ((rStart.minute() % SLOT_MINUTES) / SLOT_MINUTES) *
                          CELL_HEIGHT;
                        const blockHeight = rowsSpan * CELL_HEIGHT - topOffset - 4;

                        return (
                          <div
                            key={room.id}
                            className={cn('relative', borderClass)}
                          >
                            <button
                              onClick={() => onReservationClick(r)}
                              className={cn(
                                'absolute left-1 right-1 rounded-md text-white text-xs px-2 py-1 text-left shadow-sm hover:shadow-md transition-all border-l-4 overflow-hidden cursor-pointer z-20',
                                STATUS_BG[r.status],
                                STATUS_BORDER[r.status]
                              )}
                              style={{
                                top: `${topOffset + 2}px`,
                                height: `${blockHeight}px`,
                              }}
                            >
                              <div className="font-semibold truncate">
                                {r.customerName}
                              </div>
                              <div className="opacity-90 text-[10px] truncate">
                                {rStart.format('HH:mm')}-
                                {rEnd.format('HH:mm')} ·{' '}
                                {Math.floor(durationMins / 60)}h
                                {durationMins % 60 !== 0
                                  ? `${durationMins % 60}m`
                                  : ''}
                              </div>
                              {r.status !== 'cancelled' &&
                                r.status !== 'no_show' && (
                                  <div className="opacity-90 text-[10px] mt-0.5 truncate">
                                    {r.peopleCount}人 · 订金￥
                                    {r.depositAmount}
                                  </div>
                                )}
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={room.id}
                          className={cn('relative', borderClass)}
                        />
                      );
                    }

                    return (
                      <button
                        key={room.id}
                        onClick={() =>
                          onSlotClick(room.id, slotStart.toISOString())
                        }
                        className={cn(
                          'w-full h-full hover:bg-primary-50 hover:border-primary-300 border border-transparent transition-colors',
                          borderClass
                        )}
                        title={`点击创建 ${room.name} ${slot.label} 的预约`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-500" />
          待确认
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-500" />
          已到店
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-400" />
          已取消
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-400" />
          爽约
        </span>
        <span className="ml-auto">点击空白格可快速创建预约</span>
      </div>
    </div>
  );
}
