import { useState } from 'react';
import { X, Loader2, Play } from 'lucide-react';
import type { Room } from '../../../shared/api-types';
import { cnSpec, formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

interface QuickStartModalProps {
  room: Room.RoomStatus;
  onClose: () => void;
  onConfirm: (data: { roomId: number; peopleCount: number; hours: number }) => Promise<void>;
}

export function QuickStartModal({ room, onClose, onConfirm }: QuickStartModalProps) {
  const [peopleCount, setPeopleCount] = useState(Math.max(1, Math.floor(room.capacity / 2)));
  const [hours, setHours] = useState(2);
  const [loading, setLoading] = useState(false);

  const estimatedFee = room.basePrice * hours;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onConfirm({ roomId: room.id, peopleCount, hours });
      onClose();
    } catch {
      // handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Play className="w-5 h-5 text-primary-600" />
              快速开台
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="modal-body space-y-5">
            <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
              <div>
                <p className="text-lg font-semibold text-slate-800">{room.name}</p>
                <p className="text-sm text-slate-500">
                  {cnSpec(room.spec)} · 容纳{room.capacity}人 · {formatMoney(room.basePrice)}/小时
                </p>
              </div>
            </div>

            <div>
              <label className="label">人数</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))}
                  className="w-10 h-10 rounded-lg border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  disabled={peopleCount <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={room.capacity}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Math.max(1, Math.min(room.capacity, Number(e.target.value) || 1)))}
                  className="input text-center text-lg font-semibold !py-3 flex-1 max-w-[120px]"
                />
                <button
                  type="button"
                  onClick={() => setPeopleCount(Math.min(room.capacity, peopleCount + 1))}
                  className="w-10 h-10 rounded-lg border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  disabled={peopleCount >= room.capacity}
                >
                  +
                </button>
                <span className="text-sm text-slate-500 whitespace-nowrap">/ {room.capacity}人</span>
              </div>
            </div>

            <div>
              <label className="label">时长（小时）</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={cn(
                      'py-3 rounded-lg border text-sm font-medium transition-colors',
                      hours === h
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {h}小时
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-accent-50 rounded-lg border border-accent-100">
              <span className="text-slate-600">预估费用</span>
              <span className="text-2xl font-bold text-accent-600">{formatMoney(estimatedFee)}</span>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  开台中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  确认开台
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
