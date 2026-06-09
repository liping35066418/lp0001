import { useState } from 'react';
import { AlertTriangle, Clock, PlusCircle, Receipt, X } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { useNavigate } from 'react-router-dom';
import type { RoomSessionInfo } from '@/components/dashboard/RoomCard';
import { formatMoney } from '@/utils/format';
import dayjs from 'dayjs';

interface Props {
  sessionInfo: RoomSessionInfo | null;
  roomName?: string;
  basePrice?: number;
  onClose: () => void;
  onExtendSuccess?: () => void;
  dismissKey: string;
  onDismiss: (key: string) => void;
}

export default function OvertimeReminderModal({
  sessionInfo,
  roomName,
  basePrice = 0,
  onClose,
  onExtendSuccess,
  dismissKey,
  onDismiss,
}: Props) {
  const navigate = useNavigate();
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const [extending, setExtending] = useState(false);

  if (!sessionInfo) return null;

  const overtimeMinutes = Math.max(0, -sessionInfo.remainingMinutes);
  const overtimeQuarters = Math.ceil(overtimeMinutes / 15);
  const estimatedOvertimeFee = Number(
    ((overtimeQuarters * 15 / 60) * basePrice * 1.0).toFixed(2),
  );
  const extendCost = basePrice;
  const newEndTime = dayjs(sessionInfo.scheduledEndAt).add(1, 'hour').format('HH:mm');

  const handleExtend = async () => {
    setExtending(true);
    pushLoading();
    try {
      await post(`/sessions/${sessionInfo.sessionId}/extend`, { addHours: 1 });
      pushToast(`成功续单1小时，新增费用${formatMoney(extendCost)}`, 'success');
      onExtendSuccess?.();
      onClose();
    } catch (e) {
      pushToast((e as Error).message || '续单失败', 'error');
    } finally {
      setExtending(false);
      popLoading();
    }
  };

  const handleCheckout = () => {
    navigate(`/checkout/${sessionInfo.sessionId}`);
  };

  const handleLater = () => {
    onDismiss(dismissKey);
    onClose();
  };

  return (
    <Modal open={!!sessionInfo} onClose={onClose} size="md">
      <div className="p-1">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-red-500 via-orange-500 to-amber-500 text-white p-6 shadow-xl">
          <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/3 -translate-x-1/3" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/3 translate-x-1/3" />

          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs opacity-80">场次超时提醒</p>
                  <h2 className="text-2xl font-bold mt-0.5">
                    {roomName || `#${sessionInfo.sessionId}`} 已超时
                  </h2>
                </div>
                <button
                  onClick={handleLater}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/15 backdrop-blur border border-white/20 p-3">
                  <p className="text-xs opacity-80 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    超时时长
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {overtimeMinutes}
                    <span className="text-sm font-normal ml-1 opacity-80">分钟</span>
                  </p>
                </div>
                <div className="rounded-xl bg-white/15 backdrop-blur border border-white/20 p-3">
                  <p className="text-xs opacity-80">预计超时费用</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {formatMoney(estimatedOvertimeFee)}
                  </p>
                </div>
              </div>

              <div className="mt-4 text-sm space-y-1 opacity-90">
                <p>
                  客人：
                  <b>{sessionInfo.customerName}</b> · {sessionInfo.peopleCount}人
                </p>
                <p>
                  开台时间：{dayjs(sessionInfo.startAt).format('HH:mm')}
                  ，原定结束：{dayjs(sessionInfo.scheduledEndAt).format('HH:mm')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            onClick={handleLater}
            className="btn-outline"
          >
            稍后再说
          </button>
          <button
            onClick={handleCheckout}
            className="btn-outline border-red-300 text-red-700 hover:bg-red-50"
          >
            <Receipt className="w-4 h-4" />
            准备结账
          </button>
          <button
            onClick={handleExtend}
            disabled={extending}
            className="btn-primary"
          >
            <PlusCircle className="w-4 h-4" />
            续单1小时
            <span className="ml-1 opacity-80 text-xs">
              +{formatMoney(extendCost)}
            </span>
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          超时后每15分钟将自动提醒一次 · 预计到 {newEndTime} 结束
        </p>
      </div>
    </Modal>
  );
}
