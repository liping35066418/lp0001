import { useState } from 'react';
import { CheckCircle, XCircle, CalendarClock, Phone, Users, DollarSign } from 'lucide-react';
import type { Reservation } from '../../../shared/api-types';
import { formatDate, formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

const statusConfig: Record<Reservation.Status, { label: string; className: string }> = {
  pending: { label: '待确认', className: 'bg-blue-100 text-blue-700' },
  checked_in: { label: '已到店', className: 'bg-accent-100 text-accent-700' },
  cancelled: { label: '已取消', className: 'bg-slate-100 text-slate-500' },
  no_show: { label: '爽约', className: 'bg-red-100 text-red-700' },
};

interface ReservationTableProps {
  reservations: Reservation.Reservation[];
  loading?: boolean;
  onStartSession: (reservation: Reservation.Reservation) => void;
  onCancel: (reservationId: number) => Promise<void>;
}

export function ReservationTable({
  reservations,
  loading,
  onStartSession,
  onCancel,
}: ReservationTableProps) {
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const handleCancel = async (id: number) => {
    setCancelingId(id);
    try {
      await onCancel(id);
    } finally {
      setCancelingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-primary-600" />
          今日预约列表
        </h3>
        <span className="text-sm text-slate-500">共 {reservations.length} 条</span>
      </div>

      {reservations.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>今日暂无预约</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">时间</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">包厢</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">顾客</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">电话</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">人数</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">订金</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">状态</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((r) => {
                const cfg = statusConfig[r.status];
                const isPending = r.status === 'pending';
                const isCanceling = cancelingId === r.id;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                      <span className="font-medium">{formatDate(r.startAt, 'HH:mm')}</span>
                      <span className="text-slate-400 ml-1">- {formatDate(r.endAt, 'HH:mm')}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-800">
                      {r.roomName || '-'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {r.customerName}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {r.customerPhone}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-700">
                      {r.peopleCount}人
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-slate-700">
                        <DollarSign className="w-3.5 h-3.5 text-accent-600" />
                        <span className="font-medium">{formatMoney(r.depositAmount)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={cn('badge', cfg.className)}>{cfg.label}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onStartSession(r)}
                            className="btn-primary btn-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            开台
                          </button>
                          <button
                            onClick={() => handleCancel(r.id)}
                            disabled={isCanceling}
                            className="btn-outline btn-sm text-red-600 hover:bg-red-50 border-red-200"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {isCanceling ? '取消中' : '取消'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
