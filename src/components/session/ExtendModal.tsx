import { useState } from 'react';
import { X, Clock3, CheckCircle, AlertCircle } from 'lucide-react';
import { post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Session } from '../../../shared/api-types';
import { formatMoney, formatDateTime } from '@/utils/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  session: Session.SessionDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

const HOUR_OPTIONS = [
  { hours: 1, label: '1 小时', desc: '标准续单' },
  { hours: 2, label: '2 小时', desc: '推荐选择', recommended: true },
  { hours: 3, label: '3 小时', desc: '长时间畅玩' },
];

export default function ExtendModal({
  open,
  session,
  onClose,
  onSuccess,
}: Props) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [selectedHours, setSelectedHours] = useState(2);
  const [submitting, setSubmitting] = useState(false);

  if (!open || !session) return null;

  const currentEnd = new Date(session.scheduledEndAt);
  const newEnd = new Date(currentEnd.getTime() + selectedHours * 60 * 60 * 1000);

  const estimatedExtraFee = Math.ceil(selectedHours) * 50;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await post(`/sessions/${session.id}/extend`, {
        sessionId: session.id,
        addHours: selectedHours,
      });
      pushToast(`续单 ${selectedHours} 小时成功！`, 'success');
      onSuccess();
      onClose();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal animate-slide-up !max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <Clock3 size={20} className="text-accent-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              场次续单
            </h2>
            <span className="text-sm text-slate-400">
              {session.roomName} · #{session.id}
            </span>
          </div>
          <button className="btn-sm btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body space-y-5">
          <div className="p-4 bg-gradient-to-r from-accent-50 to-primary-50 rounded-xl">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500 mb-1">当前结束时间</div>
                <div className="font-semibold text-slate-800 line-through text-slate-500">
                  {formatDateTime(session.scheduledEndAt)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  新结束时间
                  <CheckCircle size={12} className="text-green-500" />
                </div>
                <div className="font-semibold text-primary-700">
                  {formatDateTime(newEnd)}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              选择续单时长
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {HOUR_OPTIONS.map((opt) => {
                const isActive = selectedHours === opt.hours;
                return (
                  <button
                    key={opt.hours}
                    onClick={() => setSelectedHours(opt.hours)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all relative overflow-hidden',
                      isActive
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-slate-200 hover:border-primary-300 bg-white'
                    )}
                  >
                    {opt.recommended && (
                      <div className="absolute top-0 right-0 bg-accent-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg">
                        推荐
                      </div>
                    )}
                    <div
                      className={cn(
                        'text-2xl font-bold mb-1',
                        isActive ? 'text-primary-700' : 'text-slate-800'
                      )}
                    >
                      {opt.hours}h
                    </div>
                    <div
                      className={cn(
                        'text-xs',
                        isActive ? 'text-primary-600' : 'text-slate-500'
                      )}
                    >
                      {opt.desc}
                    </div>
                    {isActive && (
                      <CheckCircle
                        size={18}
                        className="absolute top-2 left-2 text-primary-600"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">续单时长</span>
              <span className="font-medium text-slate-800">
                {selectedHours} 小时
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">预估续单费用</span>
              <span className="font-bold text-accent-600 text-lg tabular-nums">
                {formatMoney(estimatedExtraFee)}
              </span>
            </div>
            <div className="h-px bg-slate-200 my-2" />
            <div className="flex items-start gap-2 text-xs text-slate-500">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>
                实际费用以系统计算为准，续单后可点击「刷新费用」查看最新金额。超时费用按分钟阶梯累计。
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>
            取消
          </button>
          <button
            className={cn(
              'btn-accent',
              submitting && 'opacity-70 pointer-events-none'
            )}
            onClick={handleSubmit}
            disabled={submitting}
          >
            <Clock3 size={16} />
            {submitting ? '处理中...' : `确认续单 ${selectedHours}h`}
          </button>
        </div>
      </div>
    </div>
  );
}
