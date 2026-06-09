import {
  X,
  User,
  Phone,
  Users,
  Calendar,
  Clock,
  MapPin,
  Wallet,
  FileText,
  Edit,
  XCircle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import type { Reservation } from '../../../shared/api-types';
import { formatDateTime, formatMoney, cnSpec } from '@/utils/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  reservation: Reservation.Reservation | null;
  roomInfo?: { name: string; spec: string };
  onClose: () => void;
  onEdit: (r: Reservation.Reservation) => void;
  onCancel: (r: Reservation.Reservation) => void;
  onCheckIn: (r: Reservation.Reservation) => void;
}

const STATUS_STYLES: Record<Reservation.Status, string> = {
  pending: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-600',
  no_show: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<Reservation.Status, string> = {
  pending: '待确认',
  checked_in: '已到店',
  cancelled: '已取消',
  no_show: '爽约',
};

export default function ReservationDetailModal({
  open,
  reservation,
  roomInfo,
  onClose,
  onEdit,
  onCancel,
  onCheckIn,
}: Props) {
  if (!open || !reservation) return null;

  const r = reservation;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal !max-w-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800">
              预约详情
            </h2>
            <span className={`badge ${STATUS_STYLES[r.status]}`}>
              {STATUS_LABELS[r.status]}
            </span>
            <span className="text-sm text-slate-400 font-mono">
              #{String(r.id).padStart(6, '0')}
            </span>
          </div>
          <button className="btn-sm btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <User size={16} className="text-primary-600" />
                <h3 className="font-semibold text-slate-700">顾客信息</h3>
              </div>

              <InfoRow
                icon={<User size={14} className="text-slate-400" />}
                label="顾客姓名"
                value={r.customerName}
              />
              <InfoRow
                icon={<Phone size={14} className="text-slate-400" />}
                label="联系电话"
                value={r.customerPhone}
                mono
              />
              <InfoRow
                icon={<Users size={14} className="text-slate-400" />}
                label="到场人数"
                value={`${r.peopleCount} 人`}
              />
              {r.depositAmount > 0 && (
                <InfoRow
                  icon={<Wallet size={14} className="text-slate-400" />}
                  label="预付订金"
                  value={formatMoney(r.depositAmount)}
                  highlight
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Calendar size={16} className="text-primary-600" />
                <h3 className="font-semibold text-slate-700">预约信息</h3>
              </div>

              <InfoRow
                icon={<MapPin size={14} className="text-slate-400" />}
                label="预约包厢"
                value={
                  <div>
                    <span className="font-medium">
                      {roomInfo?.name || r.roomName || `#${r.roomId}`}
                    </span>
                    {roomInfo?.spec && (
                      <span
                        className={`badge ml-2 ${cnSpec(roomInfo.spec as never)}`}
                      >
                        {cnSpec(roomInfo.spec as never)}
                      </span>
                    )}
                  </div>
                }
              />
              <InfoRow
                icon={<Clock size={14} className="text-slate-400" />}
                label="开始时间"
                value={formatDateTime(r.startAt)}
              />
              <InfoRow
                icon={<Clock size={14} className="text-slate-400" />}
                label="结束时间"
                value={formatDateTime(r.endAt)}
              />
              <InfoRow
                icon={<FileText size={14} className="text-slate-400" />}
                label="创建时间"
                value={formatDateTime(r.createdAt)}
                muted
              />
            </div>
          </div>

          {r.remark && (
            <div className="mt-6 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-slate-400 mt-0.5" />
                <div>
                  <div className="text-xs text-slate-500 mb-1">备注信息</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {r.remark}
                  </div>
                </div>
              </div>
            </div>
          )}

          {r.status === 'cancelled' && (
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 text-slate-600">
                <AlertCircle size={14} />
                <span className="text-sm">此预约已被取消</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>
            关闭
          </button>
          {r.status === 'pending' && (
            <>
              <button
                className="btn-danger"
                onClick={() => onCancel(r)}
              >
                <XCircle size={16} />
                取消预约
              </button>
              <button
                className="btn-primary"
                onClick={() => onEdit(r)}
              >
                <Edit size={16} />
                修改预约
              </button>
              <button
                className="btn-accent"
                onClick={() => onCheckIn(r)}
              >
                <PlayCircle size={16} />
                开台入场
              </button>
            </>
          )}
          {r.status === 'checked_in' && r.sessionId && (
            <button className="btn-accent" onClick={() => onCheckIn(r)}>
              查看场次 #{r.sessionId}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
  highlight,
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{label}</div>
        <div
          className={cn(
            'text-sm',
            mono && 'font-mono',
            highlight
              ? 'text-accent-600 font-semibold'
              : muted
              ? 'text-slate-500'
              : 'text-slate-800'
          )}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
