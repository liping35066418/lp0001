import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Users,
  MapPin,
  Calendar,
  Clock,
  Wallet,
  FileText,
  AlertTriangle,
  CheckCircle,
  Save,
} from 'lucide-react';
import dayjs from 'dayjs';
import { get, post, put } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type {
  Reservation,
  Room,
} from '../../shared/api-types';
import { formatDateTime, formatMoney, todayStr } from '@/utils/format';
import { cn } from '@/lib/utils';

const DURATION_OPTIONS = [
  { value: 60, label: '1 小时' },
  { value: 120, label: '2 小时' },
  { value: 180, label: '3 小时' },
  { value: 240, label: '4 小时' },
  { value: -1, label: '自定义' },
];

export default function ReservationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pushToast = useUIStore((s) => s.pushToast);

  const editId = searchParams.get('id');
  const preRoomId = searchParams.get('roomId');
  const preDate = searchParams.get('date');
  const preTime = searchParams.get('time');

  const isEdit = !!editId;

  const [rooms, setRooms] = useState<Room.Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    peopleCount: 2,
    roomId: preRoomId ? Number(preRoomId) : 0,
    date: preDate || todayStr(),
    startTime: preTime || '14:00',
    duration: 120,
    customMinutes: 120,
    depositAmount: 0,
    remark: '',
  });

  const [conflict, setConflict] = useState<{
    show: boolean;
    data: Reservation.Reservation[];
  }>({ show: false, data: [] });

  useEffect(() => {
    fetchRooms();
    if (editId) fetchForEdit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const fetchRooms = async () => {
    try {
      const list = await get<Room.Room[]>('/rooms');
      const available = list.filter((r) => r.status !== 'disabled');
      setRooms(available);
      if (!preRoomId && available.length > 0 && form.roomId === 0) {
        setForm((f) => ({ ...f, roomId: available[0].id }));
      }
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  const fetchForEdit = async () => {
    try {
      setLoading(true);
      const r = await get<Reservation.Reservation>(`/reservations/${editId}`);
      const s = dayjs(r.startAt);
      const e2 = dayjs(r.endAt);
      const mins = e2.diff(s, 'minute');
      setForm({
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        peopleCount: r.peopleCount,
        roomId: r.roomId,
        date: s.format('YYYY-MM-DD'),
        startTime: s.format('HH:mm'),
        duration: DURATION_OPTIONS.some((o) => o.value === mins) ? mins : -1,
        customMinutes: mins,
        depositAmount: r.depositAmount,
        remark: r.remark || '',
      });
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const effectiveMinutes = useMemo(
    () => (form.duration === -1 ? form.customMinutes : form.duration),
    [form.duration, form.customMinutes]
  );

  const endAt = useMemo(() => {
    if (!form.date || !form.startTime || effectiveMinutes <= 0) return null;
    return dayjs(`${form.date} ${form.startTime}`).add(
      effectiveMinutes,
      'minute'
    );
  }, [form.date, form.startTime, effectiveMinutes]);

  const selectedRoom = rooms.find((r) => r.id === form.roomId);

  const validate = (): string | null => {
    if (!form.customerName.trim()) return '请填写顾客姓名';
    if (!/^1\d{10}$/.test(form.customerPhone.trim()))
      return '请填写正确的11位手机号';
    if (form.peopleCount < 1) return '人数至少1人';
    if (selectedRoom && form.peopleCount > selectedRoom.capacity)
      return `包厢最多容纳 ${selectedRoom.capacity} 人`;
    if (!form.roomId) return '请选择包厢';
    if (!form.date) return '请选择日期';
    if (!form.startTime) return '请选择开始时间';
    if (effectiveMinutes < 30) return '时长至少30分钟';
    return null;
  };

  const buildConflictReq = () => {
    const start = dayjs(`${form.date} ${form.startTime}`).toISOString();
    const end = dayjs(start).add(effectiveMinutes, 'minute').toISOString();
    const body: Reservation.CheckConflictReq = {
      roomId: form.roomId,
      startAt: start,
      endAt: end,
    };
    if (editId) body.excludeId = Number(editId);
    return body;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      pushToast(err, 'warn');
      return;
    }

    setSubmitting(true);
    try {
      const checkResp = await post<Reservation.CheckConflictResp>(
        '/reservations/check-conflict',
        buildConflictReq()
      );

      if (checkResp.conflict && checkResp.conflicting) {
        setConflict({ show: true, data: checkResp.conflicting });
        setSubmitting(false);
        return;
      }

      const startAt = dayjs(`${form.date} ${form.startTime}`).toISOString();
      const endAtVal = dayjs(startAt)
        .add(effectiveMinutes, 'minute')
        .toISOString();

      const payload = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        peopleCount: form.peopleCount,
        roomId: form.roomId,
        startAt,
        endAt: endAtVal,
        depositAmount: Number(form.depositAmount) || 0,
        remark: form.remark.trim() || undefined,
      };

      if (isEdit) {
        await put(`/reservations/${editId}`, payload);
        pushToast('预约修改成功！', 'success');
      } else {
        await post('/reservations', payload);
        pushToast('预约创建成功！', 'success');
      }
      navigate('/reservations');
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-slate-100 rounded w-48 animate-pulse-soft" />
        <div className="card p-6 space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse-soft" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          className="btn-outline btn-sm"
          onClick={() => navigate('/reservations')}
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? '编辑预约' : '新建预约'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEdit ? '修改已有的顾客预约信息' : '创建新的顾客预约记录'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
              <User size={18} className="text-primary-600" />
              顾客信息
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  顾客姓名 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    className="input pl-9"
                    placeholder="请输入顾客姓名"
                    value={form.customerName}
                    onChange={(e) =>
                      setForm({ ...form, customerName: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="label">
                  联系电话 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="tel"
                    className="input pl-9 font-mono"
                    placeholder="11位手机号"
                    maxLength={11}
                    value={form.customerPhone}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customerPhone: e.target.value.replace(/\D/g, ''),
                      })
                    }
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label">
                  到场人数 <span className="text-red-500">*</span>
                  {selectedRoom && (
                    <span className="ml-2 text-xs text-slate-400 font-normal">
                      （包厢上限 {selectedRoom.capacity} 人）
                    </span>
                  )}
                </label>
                <div className="relative max-w-[200px]">
                  <Users
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="number"
                    min={1}
                    max={selectedRoom?.capacity || 30}
                    className="input pl-9"
                    value={form.peopleCount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        peopleCount: Math.max(
                          1,
                          Math.min(
                            selectedRoom?.capacity || 999,
                            Number(e.target.value) || 1
                          )
                        ),
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Calendar size={18} className="text-primary-600" />
              预约信息
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">
                  选择包厢 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <select
                    className="input pl-9"
                    value={form.roomId}
                    onChange={(e) =>
                      setForm({ ...form, roomId: Number(e.target.value) })
                    }
                  >
                    <option value={0}>请选择包厢</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.capacity}人 · ￥{r.basePrice}/时
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">
                  预约日期 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    className="input pl-9"
                    value={form.date}
                    onChange={(e) =>
                      setForm({ ...form, date: e.target.value })
                    }
                    min={todayStr()}
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  开始时间 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="time"
                    className="input pl-9"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm({ ...form, startTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  时长 <span className="text-red-500">*</span>
                </label>
                <select
                  className="input"
                  value={form.duration}
                  onChange={(e) =>
                    setForm({ ...form, duration: Number(e.target.value) })
                  }
                >
                  {DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {form.duration === -1 && (
                <div>
                  <label className="label">自定义时长（分钟）</label>
                  <input
                    type="number"
                    min={30}
                    step={15}
                    className="input"
                    value={form.customMinutes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customMinutes: Math.max(
                          30,
                          Number(e.target.value) || 30
                        ),
                      })
                    }
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
                  <Clock size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600">
                    预计结束时间：
                    {endAt ? (
                      <span className="font-semibold text-slate-800">
                        {formatDateTime(endAt.toISOString())}
                      </span>
                    ) : (
                      <span className="text-slate-400">请完善时间信息</span>
                    )}
                    <span className="mx-2 text-slate-300">|</span>
                    共
                    <span className="font-semibold text-primary-600 mx-1">
                      {effectiveMinutes}
                    </span>
                    分钟
                    {selectedRoom && (
                      <>
                        <span className="mx-2 text-slate-300">|</span>
                        预估包厢费
                        <span className="font-semibold text-accent-600 mx-1">
                          {formatMoney(
                            Math.ceil(effectiveMinutes / 60) *
                              selectedRoom.basePrice
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileText size={18} className="text-primary-600" />
              其他信息
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">订金金额（元）</label>
                <div className="relative">
                  <Wallet
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="number"
                    min={0}
                    step={10}
                    className="input pl-9"
                    value={form.depositAmount}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        depositAmount: Math.max(
                          0,
                          Number(e.target.value) || 0
                        ),
                      })
                    }
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="label">备注</label>
                <textarea
                  className="input min-h-[90px] resize-y"
                  placeholder="可填写顾客特殊要求等信息..."
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5 sticky top-4">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle size={16} className="text-primary-600" />
              预约摘要
            </h3>
            <div className="space-y-3 text-sm">
              <SummaryRow
                label="包厢"
                value={
                  selectedRoom ? (
                    <span className="font-medium text-slate-800">
                      {selectedRoom.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">未选择</span>
                  )
                }
              />
              <SummaryRow
                label="顾客"
                value={
                  form.customerName ? (
                    <span>
                      {form.customerName}
                      <span className="ml-2 text-slate-500 font-mono text-xs">
                        {form.customerPhone}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400">未填写</span>
                  )
                }
              />
              <SummaryRow
                label="人数"
                value={
                  <span className="font-medium">{form.peopleCount} 人</span>
                }
              />
              <SummaryRow
                label="时段"
                value={
                  endAt ? (
                    <div className="text-right">
                      <div>{formatDateTime(`${form.date} ${form.startTime}`)}</div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        至 {formatDateTime(endAt.toISOString())}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-400">待完善</span>
                  )
                }
              />
              <div className="h-px bg-slate-100 my-2" />
              <SummaryRow
                label="订金"
                value={
                  <span className="font-semibold text-accent-600">
                    {formatMoney(form.depositAmount)}
                  </span>
                }
              />
            </div>

            <div className="mt-5 space-y-2">
              <button
                className={cn(
                  'btn-primary w-full justify-center',
                  submitting && 'opacity-70 pointer-events-none'
                )}
                onClick={handleSubmit}
                disabled={submitting}
              >
                <Save size={16} />
                {submitting ? '提交中...' : '校验冲突并提交'}
              </button>
              <button
                className="btn-outline w-full"
                onClick={() => navigate('/reservations')}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      {conflict.show && (
        <div className="modal-backdrop" onClick={() => setConflict({ show: false, data: [] })}>
          <div
            className="modal animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={20} />
                <h2 className="text-lg font-semibold">时段冲突提醒</h2>
              </div>
            </div>
            <div className="modal-body">
              <p className="text-sm text-slate-600 mb-4">
                该时段已被预约，请调整时间或更换包厢：
              </p>
              <div className="space-y-2">
                {conflict.data.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-red-50 border border-red-100 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-800">
                        {r.customerName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {r.customerPhone}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {formatDateTime(r.startAt)} ~ {formatDateTime(r.endAt)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {r.peopleCount}人 · 订金{formatMoney(r.depositAmount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => setConflict({ show: false, data: [] })}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500 flex-shrink-0 pt-0.5">{label}</span>
      <div className="text-right text-slate-700 flex-1 min-w-0 break-all">
        {value}
      </div>
    </div>
  );
}
