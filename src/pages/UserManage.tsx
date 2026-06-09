import { useEffect, useState } from 'react';
import { Plus, Pencil, KeyRound, Power } from 'lucide-react';
import AdminGuard from '@/components/common/AdminGuard';
import Modal from '@/components/common/Modal';
import { get, post, put } from '@/utils/api';
import { formatDateTime } from '@/utils/format';
import { useUIStore } from '@/store/ui';
import type { User } from '../../shared/api-types';

interface UserFormData {
  username: string;
  realName: string;
  role: User.Role;
  phone: string;
  password: string;
}

interface ResetPwdData {
  newPassword: string;
  confirmPassword: string;
}

const defaultForm: UserFormData = {
  username: '',
  realName: '',
  role: 'operator',
  phone: '',
  password: '',
};

const roleOptions: { value: User.Role; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'operator', label: '操作员' },
];

function UsersContent() {
  const { pushToast } = useUIStore();
  const [users, setUsers] = useState<User.User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormData>(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetForm, setResetForm] = useState<ResetPwdData>({
    newPassword: '',
    confirmPassword: '',
  });
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});

  const loadUsers = async () => {
    try {
      const list = await get<User.User[]>('/users');
      setUsers(list);
    } catch (e) {
      pushToast('加载失败', 'error');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (u: User.User) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      realName: u.realName,
      role: u.role,
      phone: u.phone || '',
      password: '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validateUserForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = '请输入用户名';
    else if (form.username.length < 3) e.username = '用户名至少3位';
    else if (form.username.length > 20) e.username = '用户名不能超过20位';
    if (!editingId && !form.password) e.password = '请设置初始密码';
    if (!editingId && form.password && form.password.length < 6)
      e.password = '密码至少6位';
    if (!form.realName.trim()) e.realName = '请输入真实姓名';
    if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone))
      e.phone = '请输入正确的手机号';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateUserForm()) return;
    try {
      if (editingId) {
        await put(`/users/${editingId}`, {
          realName: form.realName,
          role: form.role,
          phone: form.phone,
        });
        pushToast('更新成功', 'success');
      } else {
        await post('/users', {
          username: form.username,
          password: form.password,
          realName: form.realName,
          role: form.role,
          phone: form.phone,
        });
        pushToast('创建成功', 'success');
      }
      setModalOpen(false);
      loadUsers();
    } catch (e: any) {
      pushToast(e.message || '保存失败', 'error');
    }
  };

  const openResetPwd = (id: number) => {
    setResetUserId(id);
    setResetForm({ newPassword: '', confirmPassword: '' });
    setResetErrors({});
    setResetModalOpen(true);
  };

  const validateResetPwd = (): boolean => {
    const e: Record<string, string> = {};
    if (!resetForm.newPassword) e.newPassword = '请输入新密码';
    else if (resetForm.newPassword.length < 6) e.newPassword = '密码至少6位';
    if (resetForm.confirmPassword !== resetForm.newPassword)
      e.confirmPassword = '两次密码不一致';
    setResetErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleResetPwd = async () => {
    if (!resetUserId || !validateResetPwd()) return;
    try {
      await post(`/users/${resetUserId}/reset-password`, {
        newPassword: resetForm.newPassword,
      });
      pushToast('密码重置成功', 'success');
      setResetModalOpen(false);
      setResetUserId(null);
    } catch (e: any) {
      pushToast(e.message || '操作失败', 'error');
    }
  };

  const toggleStatus = async (u: User.User) => {
    const newStatus = u.status === 'active' ? 'disabled' : 'active';
    try {
      await put(`/users/${u.id}`, { status: newStatus });
      pushToast(newStatus === 'active' ? '已启用' : '已禁用', 'success');
      loadUsers();
    } catch (e: any) {
      pushToast(e.message || '操作失败', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">账号管理</h1>
          <p className="text-sm text-slate-500 mt-1">系统用户和权限管理</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          新增操作员
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-600">用户名</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">真实姓名</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">角色</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">手机号</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">状态</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">最后登录</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    暂无账号数据
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-800">{u.username}</td>
                    <td className="py-3 px-4 text-slate-700">{u.realName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          u.role === 'admin'
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-accent-100 text-accent-700'
                        }`}
                      >
                        {u.role === 'admin' ? '管理员' : '操作员'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.phone || '-'}</td>
                    <td className="py-3 px-4">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={u.status === 'active'}
                          onChange={() => toggleStatus(u)}
                        />
                        <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                      </label>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '未登录'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="btn-ghost btn-sm text-primary-600"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          className="btn-ghost btn-sm text-accent-600"
                          onClick={() => openResetPwd(u.id)}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          重置密码
                        </button>
                        <button
                          className={`btn-ghost btn-sm ${
                            u.status === 'active' ? 'text-slate-500' : 'text-green-600'
                          }`}
                          onClick={() => toggleStatus(u)}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {u.status === 'active' ? '禁用' : '启用'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? '编辑账号' : '新增操作员'}
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
              用户名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${formErrors.username ? 'border-red-400' : ''} ${
                editingId ? 'bg-slate-50' : ''
              }`}
              value={form.username}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="登录账号，创建后不可修改"
            />
            {formErrors.username && (
              <p className="text-xs text-red-500 mt-1">{formErrors.username}</p>
            )}
          </div>
          {!editingId && (
            <div>
              <label className="label">
                初始密码 <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                className={`input ${formErrors.password ? 'border-red-400' : ''}`}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少6位"
              />
              {formErrors.password && (
                <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                真实姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`input ${formErrors.realName ? 'border-red-400' : ''}`}
                value={form.realName}
                onChange={(e) => setForm({ ...form, realName: e.target.value })}
              />
              {formErrors.realName && (
                <p className="text-xs text-red-500 mt-1">{formErrors.realName}</p>
              )}
            </div>
            <div>
              <label className="label">
                角色 <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as User.Role })}
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">手机号</label>
            <input
              type="tel"
              className={`input ${formErrors.phone ? 'border-red-400' : ''}`}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="选填"
            />
            {formErrors.phone && (
              <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={resetModalOpen}
        title="重置密码"
        onClose={() => {
          setResetModalOpen(false);
          setResetUserId(null);
        }}
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => {
                setResetModalOpen(false);
                setResetUserId(null);
              }}
            >
              取消
            </button>
            <button className="btn btn-primary" onClick={handleResetPwd}>
              确认重置
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-accent-50 rounded-lg p-4 border border-accent-100">
            <p className="text-sm text-accent-700">
              请为该用户设置新密码，密码至少6位。
            </p>
          </div>
          <div>
            <label className="label">
              新密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className={`input ${resetErrors.newPassword ? 'border-red-400' : ''}`}
              value={resetForm.newPassword}
              onChange={(e) =>
                setResetForm({ ...resetForm, newPassword: e.target.value })
              }
              placeholder="至少6位"
            />
            {resetErrors.newPassword && (
              <p className="text-xs text-red-500 mt-1">{resetErrors.newPassword}</p>
            )}
          </div>
          <div>
            <label className="label">
              确认密码 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              className={`input ${resetErrors.confirmPassword ? 'border-red-400' : ''}`}
              value={resetForm.confirmPassword}
              onChange={(e) =>
                setResetForm({ ...resetForm, confirmPassword: e.target.value })
              }
              placeholder="再次输入新密码"
            />
            {resetErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{resetErrors.confirmPassword}</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function UserManage() {
  return (
    <AdminGuard>
      <UsersContent />
    </AdminGuard>
  );
}
