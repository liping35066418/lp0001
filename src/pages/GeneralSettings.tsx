import { useEffect, useState } from 'react';
import { Save, Store, Clock, CreditCard, FileText } from 'lucide-react';
import AdminGuard from '@/components/common/AdminGuard';
import { get, put } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Settings, Bill } from '../../shared/api-types';

const payMethodOptions: { value: Bill.PayMethod; label: string }[] = [
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信支付' },
  { value: 'alipay', label: '支付宝' },
  { value: 'member', label: '会员卡' },
  { value: 'mixed', label: '混合支付' },
];

interface FormErrors {
  shopName?: string;
  shopPhone?: string;
  businessStartTime?: string;
  businessEndTime?: string;
}

function GeneralContent() {
  const { pushToast } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Settings.GeneralSetting>({
    shopName: '桌游休闲馆',
    shopPhone: '',
    shopAddress: '',
    businessStartTime: '10:00',
    businessEndTime: '22:00',
    enabledPayMethods: ['cash', 'wechat', 'alipay'],
    receiptFooter: '感谢光临，欢迎再来！',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const loadData = async () => {
    try {
      const data = await get<Settings.GeneralSetting>('/settings/general');
      setForm(data);
    } catch (e) {
      pushToast('加载失败', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.shopName.trim()) e.shopName = '请输入门店名称';
    if (form.shopName.length > 50) e.shopName = '名称不能超过50字';
    if (form.shopPhone && !/^1[3-9]\d{9}$|^\d{3,4}-?\d{7,8}$/.test(form.shopPhone))
      e.shopPhone = '请输入正确的电话号码';
    if (!form.businessStartTime) e.businessStartTime = '请选择开始时间';
    if (!form.businessEndTime) e.businessEndTime = '请选择结束时间';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await put('/settings/general', form);
      pushToast('保存成功', 'success');
    } catch (e: any) {
      pushToast(e.message || '保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const togglePayMethod = (m: Bill.PayMethod) => {
    setForm((prev) => ({
      ...prev,
      enabledPayMethods: prev.enabledPayMethods.includes(m)
        ? prev.enabledPayMethods.filter((x) => x !== m)
        : [...prev.enabledPayMethods, m],
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">通用设置</h1>
          <p className="text-sm text-slate-500 mt-1">门店基础信息设置</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? '保存中...' : '保存设置'}
        </button>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Store className="w-5 h-5 text-primary-600" />
          <h3 className="text-base font-semibold text-slate-800">门店信息</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="label">
              门店名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`input ${errors.shopName ? 'border-red-400' : ''}`}
              value={form.shopName}
              onChange={(e) => setForm({ ...form, shopName: e.target.value })}
              placeholder="如：欢乐桌游馆"
            />
            {errors.shopName && <p className="text-xs text-red-500 mt-1">{errors.shopName}</p>}
          </div>
          <div>
            <label className="label">联系电话</label>
            <input
              type="text"
              className={`input ${errors.shopPhone ? 'border-red-400' : ''}`}
              value={form.shopPhone}
              onChange={(e) => setForm({ ...form, shopPhone: e.target.value })}
              placeholder="如：010-12345678 或 13800138000"
            />
            {errors.shopPhone && <p className="text-xs text-red-500 mt-1">{errors.shopPhone}</p>}
          </div>
          <div className="md:col-span-2">
            <label className="label">门店地址</label>
            <input
              type="text"
              className="input"
              value={form.shopAddress}
              onChange={(e) => setForm({ ...form, shopAddress: e.target.value })}
              placeholder="详细地址，将显示在小票上"
            />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-5 h-5 text-primary-600" />
          <h3 className="text-base font-semibold text-slate-800">营业时间</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
          <div>
            <label className="label">
              开始时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className={`input ${errors.businessStartTime ? 'border-red-400' : ''}`}
              value={form.businessStartTime}
              onChange={(e) => setForm({ ...form, businessStartTime: e.target.value })}
            />
            {errors.businessStartTime && (
              <p className="text-xs text-red-500 mt-1">{errors.businessStartTime}</p>
            )}
          </div>
          <div>
            <label className="label">
              结束时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              className={`input ${errors.businessEndTime ? 'border-red-400' : ''}`}
              value={form.businessEndTime}
              onChange={(e) => setForm({ ...form, businessEndTime: e.target.value })}
            />
            {errors.businessEndTime && (
              <p className="text-xs text-red-500 mt-1">{errors.businessEndTime}</p>
            )}
          </div>
          <div className="bg-accent-50 rounded-lg px-4 py-3 border border-accent-100">
            <p className="text-xs text-accent-700">
              💡 支持次日营业，如 22:00 ~ 次日 02:00
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-primary-600" />
          <h3 className="text-base font-semibold text-slate-800">支付方式启用</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {payMethodOptions.map((opt) => {
            const checked = form.enabledPayMethods.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                  checked
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => togglePayMethod(opt.value)}
                  className="w-4 h-4 accent-primary-600"
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            );
          })}
        </div>
        {form.enabledPayMethods.length === 0 && (
          <p className="text-xs text-amber-600 mt-3">⚠️ 至少启用一种支付方式</p>
        )}
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="w-5 h-5 text-primary-600" />
          <h3 className="text-base font-semibold text-slate-800">小票页脚文字</h3>
        </div>
        <textarea
          className="input min-h-[100px]"
          value={form.receiptFooter}
          onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
          placeholder="打印小票时显示的底部文字，如：感谢光临，欢迎再来！"
          maxLength={200}
        />
        <p className="text-xs text-slate-400 mt-2 text-right">
          {form.receiptFooter.length}/200
        </p>
      </div>
    </div>
  );
}

export default function GeneralSettings() {
  return (
    <AdminGuard>
      <GeneralContent />
    </AdminGuard>
  );
}
