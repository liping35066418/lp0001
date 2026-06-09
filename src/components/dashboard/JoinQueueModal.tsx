import { useState, type FormEvent } from 'react';
import { X, Users, Phone, UserCircle2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Queue } from '../../../shared/api-types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SPECS: { value: Queue.RoomSpec | ''; label: string }[] = [
  { value: '', label: '不限房型' },
  { value: 'small', label: '小包 (≤4人)' },
  { value: 'medium', label: '中包 (≤8人)' },
  { value: 'large', label: '大包 (≤12人)' },
  { value: 'vip', label: 'VIP包 (≤15人)' },
];

export default function JoinQueueModal({ open, onClose, onSuccess }: Props) {
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    peopleCount: 2,
    roomSpec: '' as Queue.RoomSpec | '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[k];
        return n;
      });
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.customerName.trim()) e.customerName = '请填写姓名';
    if (!/^1[3-9]\d{9}$/.test(form.customerPhone.trim())) e.customerPhone = '请填写正确手机号';
    if (form.peopleCount <= 0) e.peopleCount = '人数需大于0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    pushLoading();
    try {
      await post<Queue.WaitingItem>('/queue/join', {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        peopleCount: form.peopleCount,
        roomSpec: form.roomSpec || undefined,
      });
      pushToast('已加入排队等位', 'success');
      onSuccess?.();
      onClose();
      setForm({ customerName: '', customerPhone: '', peopleCount: 2, roomSpec: '' });
    } catch (err) {
      pushToast((err as Error).message || '加入失败', 'error');
    } finally {
      setSubmitting(false);
      popLoading();
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="加入等位排队">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">
            <UserCircle2 className="w-3.5 h-3.5 mr-1" />
            客人姓名
          </label>
          <input
            type="text"
            value={form.customerName}
            onChange={(e) => update('customerName', e.target.value)}
            placeholder="请输入客人姓名"
            className={cn('input', errors.customerName && 'border-red-500 focus:ring-red-500')}
          />
          {errors.customerName && (
            <p className="mt-1 text-xs text-red-500">{errors.customerName}</p>
          )}
        </div>

        <div>
          <label className="label">
            <Phone className="w-3.5 h-3.5 mr-1" />
            手机号码
          </label>
          <input
            type="tel"
            value={form.customerPhone}
            onChange={(e) => update('customerPhone', e.target.value)}
            placeholder="11位手机号"
            maxLength={11}
            className={cn('input', errors.customerPhone && 'border-red-500 focus:ring-red-500')}
          />
          {errors.customerPhone && (
            <p className="mt-1 text-xs text-red-500">{errors.customerPhone}</p>
          )}
        </div>

        <div>
          <label className="label">
            <Users className="w-3.5 h-3.5 mr-1" />
            人数
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update('peopleCount', Math.max(1, form.peopleCount - 1))}
              className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-lg"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={20}
              value={form.peopleCount}
              onChange={(e) => update('peopleCount', Math.max(1, Number(e.target.value) || 0))}
              className="input text-center font-semibold !w-20"
            />
            <button
              type="button"
              onClick={() => update('peopleCount', Math.min(20, form.peopleCount + 1))}
              className="w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-lg"
            >
              +
            </button>
            <span className="text-sm text-slate-500">人</span>
          </div>
        </div>

        <div>
          <label className="label">房型偏好 (可选)</label>
          <div className="grid grid-cols-2 gap-2">
            {SPECS.map((s) => {
              const active = form.roomSpec === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => update('roomSpec', s.value)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm transition-all',
                    active
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline flex-1"
            disabled={submitting}
          >
            <X className="w-4 h-4" />
            取消
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? '提交中...' : '确认加入排队'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
