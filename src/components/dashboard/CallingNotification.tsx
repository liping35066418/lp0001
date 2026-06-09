import { Bell, Phone, Users, Volume2, X } from 'lucide-react';
import Modal from '@/components/common/Modal';
import type { Queue } from '../../../shared/api-types';
import dayjs from 'dayjs';

interface Props {
  item: Queue.WaitingItem | null;
  onClose: () => void;
  onOpenRoom?: () => void;
}

export default function CallingNotification({ item, onClose, onOpenRoom }: Props) {
  if (!item) return null;

  const remainMin = item.calledExpireAt
    ? Math.max(0, dayjs(item.calledExpireAt).diff(dayjs(), 'minute'))
    : 15;

  return (
    <Modal open={!!item} onClose={onClose} size="sm">
      <div className="p-1">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-red-500 text-white p-6 shadow-xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0 animate-bounce">
              <Bell className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs opacity-80">等位叫号通知</p>
                  <h2 className="text-2xl font-bold mt-0.5">
                    #{item.queueNumber} 号请入场
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 opacity-80" />
                  <span className="font-semibold">{item.customerName}</span>
                  <span className="opacity-80">· {item.peopleCount}人</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 opacity-80" />
                  <span>{item.customerPhone}</span>
                </div>
                {item.assignedRoomName && (
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 opacity-80" />
                    <span>
                      请前往 <b className="text-base">{item.assignedRoomName}</b> 包厢
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 p-3 rounded-xl bg-white/15 backdrop-blur border border-white/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-80">叫号剩余时间</span>
                  <span className="font-bold text-lg tabular-nums">
                    {remainMin} 分 00 秒
                  </span>
                </div>
                <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${(remainMin / 15) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs opacity-80">
                  15分钟未到将自动跳过并通知下一位等位客人
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">
            已知晓
          </button>
          {onOpenRoom && (
            <button onClick={onOpenRoom} className="btn-primary flex-1">
              为客人开台
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
