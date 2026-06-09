import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AdminGuard from '@/components/common/AdminGuard';
import Modal from '@/components/common/Modal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { get, post, put, del } from '@/utils/api';
import { cnSpec, formatMoney, specColor } from '@/utils/format';
import { useUIStore } from '@/store/ui';
import type { Room } from '../../shared/api-types';

interface RoomFormData {
  name: string;
  spec: Room.Spec;
  capacity: number;
  basePrice: number;
  status: Room.Status;
  description: string;
}

const defaultForm: RoomFormData = {
  name: '',
  spec: 'small',
  capacity: 4,
  basePrice: 50,
  status: 'available',
  description: '',
};

const specOptions: { value: Room.Spec; label: string }[] = [
  { value: 'small', label: '小包' },
  { value: 'medium', label: '中包' },
  { value: 'large', label: '大包' },
  { value: 'vip', label: 'VIP' },
];

const statusOptions: { value: Room.Status; label: string; color: string }[] = [
  { value: 'available', label: '可用', color: 'bg-green-100 text-green-700' },
  { value: 'maintenance', label: '维护中', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'disabled', label: '已停用', color: 'bg-slate-100 text-slate-600' },
];

function RoomsContent() {
  const { pushToast } = useUIStore();
  const [rooms, setRooms] = useState<Room.Room[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RoomFormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RoomFormData, string>>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRooms = async () => {
    try {
      const list = await get<Room.Room[]>('/rooms');
      setRooms(list);
    } catch (e) {
      pushToast('加载失败', 'error');
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (room: Room.Room) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      spec: room.spec,
      capacity: room.capacity,
      basePrice: room.basePrice,
      status: room.status,
      description: room.description || '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof RoomFormData, string>> = {};
    if (!form.name.trim()) e.name = '请输入包厢名称';
    if (form.capacity <= 0) e.capacity = '容纳人数必须大于0';
    if (form.capacity > 50) e.capacity = '容纳人数不能超过50';
    if (form.basePrice < 0) e.basePrice = '单价不能为负数';
    if (form.basePrice > 10000) e.basePrice = '单价过高，请检查';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      if (editingId) {
        await put(`/rooms/${editingId}`, form);
        pushToast('更新成功', 'success');
      } else {
        await post('/rooms', form);
        pushToast('创建成功', 'success');
      }
      setModalOpen(false);
      loadRooms();
    } catch (e: any) {
      pushToast(e.message || '保存失败', 'error');
    }
  };

  const openDelete = (id: number) => {
    setDeletingId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await del(`/rooms/${deletingId}`);
      pushToast('删除成功', 'success');
      setDeleteOpen(false);
      setDeletingId(null);
      loadRooms();
    } catch (e: any) {
      pushToast(e.message || '删除失败', 'error');
    }
  };

  const visibleRooms = rooms.filter((r) => r.status !== 'disabled');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">包厢配置</h1>
          <p className="text-sm text-slate-500 mt-1">管理包厢和基础配置</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          新增包厢
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-600">名称</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">规格</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">容纳人数</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">单价/小时</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRooms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    暂无包厢数据，点击右上角新增
                  </td>
                </tr>
              ) : (
                visibleRooms.map((room) => {
                  const status = statusOptions.find((s) => s.value === room.status);
                  return (
                    <tr key={room.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-800">{room.name}</td>
                      <td className="py-3 px-4">
                        <span className={`badge ${specColor(room.spec)}`}>
                          {cnSpec(room.spec)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{room.capacity} 人</td>
                      <td className="py-3 px-4 text-right text-slate-800 font-semibold">
                        {formatMoney(room.basePrice)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${status?.color}`}>{status?.label}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost btn-sm text-primary-600"
                            onClick={() => openEdit(room)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            编辑
                          </button>
                          <button
                            className="btn-ghost btn-sm text-red-600"
                            onClick={() => openDelete(room.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? '编辑包厢' : '新增包厢'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModalOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">
              包厢名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.name ? 'border-red-400' : ''}`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="如：A101"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                规格 <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={form.spec}
                onChange={(e) => setForm({ ...form, spec: e.target.value as Room.Spec })}
              >
                {specOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                容纳人数 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={50}
                className={`input ${errors.capacity ? 'border-red-400' : ''}`}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
              {errors.capacity && (
                <p className="text-xs text-red-500 mt-1">{errors.capacity}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                单价/小时(元) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                className={`input ${errors.basePrice ? 'border-red-400' : ''}`}
                value={form.basePrice}
                onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })}
              />
              {errors.basePrice && (
                <p className="text-xs text-red-500 mt-1">{errors.basePrice}</p>
              )}
            </div>
            <div>
              <label className="label">状态</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Room.Status })}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">备注描述</label>
            <textarea
              className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="可选"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="删除确认"
        message="确定要删除该包厢吗？这将是软删除，包厢数据仍可在数据库中找到。"
        confirmText="删除"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setDeletingId(null);
        }}
        danger
      />
    </div>
  );
}

export default function RoomSettings() {
  return (
    <AdminGuard>
      <RoomsContent />
    </AdminGuard>
  );
}
