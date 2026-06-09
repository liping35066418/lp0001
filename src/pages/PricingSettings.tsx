import { useEffect, useState } from 'react';
import { Save, Calculator } from 'lucide-react';
import AdminGuard from '@/components/common/AdminGuard';
import { get, put } from '@/utils/api';
import { formatMoney } from '@/utils/format';
import { useUIStore } from '@/store/ui';
import type { Settings } from '../../shared/api-types';

type OvertimeUnit = Settings.PricingRule['overtimeUnit'];
type OvertimeMode = Settings.PricingRule['overtimeMode'];

const unitOptions: { value: OvertimeUnit; label: string }[] = [
  { value: 'minute', label: '按分钟' },
  { value: 'half_hour', label: '按30分钟' },
  { value: 'hour', label: '按小时' },
];

const modeOptions: { value: OvertimeMode; label: string; desc: string }[] = [
  { value: 'ratio', label: '比例模式', desc: '基础价的 X 倍/小时' },
  { value: 'fixed', label: '固定单价', desc: '￥X / 小时' },
];

function calculateOvertimeFee(
  basePricePerHour: number,
  overtimeMinutes: number,
  unit: OvertimeUnit,
  mode: OvertimeMode,
  rateOrPrice: number,
  freeGrace: number
): { chargeableMinutes: number; fee: number; steps: string[] } {
  const steps: string[] = [];
  const effectiveMinutes = Math.max(0, overtimeMinutes - freeGrace);
  steps.push(`超时分钟: ${overtimeMinutes}分`);
  steps.push(`扣减宽限(${freeGrace}分): ${effectiveMinutes}分`);

  let chargeable = 0;
  switch (unit) {
    case 'minute':
      chargeable = effectiveMinutes;
      steps.push(`计费单位(按分钟): ${chargeable}分`);
      break;
    case 'half_hour':
      chargeable = Math.ceil(effectiveMinutes / 30) * 30;
      steps.push(`计费单位(按30分向上取整): ${chargeable}分`);
      break;
    case 'hour':
      chargeable = Math.ceil(effectiveMinutes / 60) * 60;
      steps.push(`计费单位(按小时向上取整): ${chargeable}分`);
      break;
  }

  const hours = chargeable / 60;
  let hourlyRate = 0;
  if (mode === 'ratio') {
    hourlyRate = basePricePerHour * rateOrPrice;
    steps.push(`倍率模式: ￥${basePricePerHour} × ${rateOrPrice} = ￥${hourlyRate.toFixed(2)}/小时`);
  } else {
    hourlyRate = rateOrPrice;
    steps.push(`固定模式: ￥${hourlyRate.toFixed(2)}/小时`);
  }

  const fee = Number((hourlyRate * hours).toFixed(2));
  steps.push(`超时费: ￥${hourlyRate.toFixed(2)} × ${hours}小时 = ${formatMoney(fee)}`);

  return { chargeableMinutes: chargeable, fee, steps };
}

function PricingContent() {
  const { pushToast } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Settings.PricingRule>({
    overtimeUnit: 'half_hour',
    overtimeRate: 1.0,
    overtimeMode: 'ratio',
    minimumChargeMinutes: 60,
    freeGraceMinutes: 10,
    reminderMinutesBeforeEnd: 15,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [simBasePrice, setSimBasePrice] = useState(50);
  const [simMinutes, setSimMinutes] = useState(120);
  const [simOvertime, setSimOvertime] = useState(25);
  const [simResult, setSimResult] = useState<{
    chargeableMinutes: number;
    fee: number;
    steps: string[];
    roomFee: number;
    total: number;
  } | null>(null);

  const loadData = async () => {
    try {
      const data = await get<Settings.PricingRule>('/settings/pricing');
      setForm(data);
    } catch (e) {
      pushToast('加载失败', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.minimumChargeMinutes < 15 || form.minimumChargeMinutes > 480)
      e.minimumChargeMinutes = '最低消费需在15-480分钟之间';
    if (form.freeGraceMinutes < 0 || form.freeGraceMinutes > 60)
      e.freeGraceMinutes = '宽限时间需在0-60分钟之间';
    if (form.reminderMinutesBeforeEnd < 0 || form.reminderMinutesBeforeEnd > 120)
      e.reminderMinutesBeforeEnd = '提醒时间需在0-120分钟之间';
    if (form.overtimeMode === 'ratio') {
      if (form.overtimeRate < 0.5 || form.overtimeRate > 5)
        e.overtimeRate = '倍率需在0.5-5倍之间';
    } else {
      if (form.overtimeRate < 0 || form.overtimeRate > 1000)
        e.overtimeRate = '固定价需在0-1000元之间';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await put('/settings/pricing', form);
      pushToast('保存成功', 'success');
    } catch (e: any) {
      pushToast(e.message || '保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = () => {
    const baseHours = form.minimumChargeMinutes / 60;
    const roomFee = Number((simBasePrice * Math.max(simMinutes / 60, baseHours)).toFixed(2));

    const result = calculateOvertimeFee(
      simBasePrice,
      simOvertime,
      form.overtimeUnit,
      form.overtimeMode,
      form.overtimeRate,
      form.freeGraceMinutes
    );

    setSimResult({
      ...result,
      roomFee,
      total: Number((roomFee + result.fee).toFixed(2)),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">计费设置</h1>
          <p className="text-sm text-slate-500 mt-1">计费规则和价格策略</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? '保存中...' : '保存设置'}
        </button>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-6">基础计费规则</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="label">
              最低消费分钟数 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={15}
              max={480}
              className={`input ${errors.minimumChargeMinutes ? 'border-red-400' : ''}`}
              value={form.minimumChargeMinutes}
              onChange={(e) =>
                setForm({ ...form, minimumChargeMinutes: Number(e.target.value) })
              }
            />
            <p className="text-xs text-slate-400 mt-1">不足此时长也按此收费（默认60分钟）</p>
            {errors.minimumChargeMinutes && (
              <p className="text-xs text-red-500 mt-1">{errors.minimumChargeMinutes}</p>
            )}
          </div>

          <div>
            <label className="label">
              免费宽限分钟 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={60}
              className={`input ${errors.freeGraceMinutes ? 'border-red-400' : ''}`}
              value={form.freeGraceMinutes}
              onChange={(e) =>
                setForm({ ...form, freeGraceMinutes: Number(e.target.value) })
              }
            />
            <p className="text-xs text-slate-400 mt-1">超时后此时长内不计超时费（默认10分钟）</p>
            {errors.freeGraceMinutes && (
              <p className="text-xs text-red-500 mt-1">{errors.freeGraceMinutes}</p>
            )}
          </div>

          <div>
            <label className="label">
              结束前提醒分钟 <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              max={120}
              className={`input ${errors.reminderMinutesBeforeEnd ? 'border-red-400' : ''}`}
              value={form.reminderMinutesBeforeEnd}
              onChange={(e) =>
                setForm({ ...form, reminderMinutesBeforeEnd: Number(e.target.value) })
              }
            />
            <p className="text-xs text-slate-400 mt-1">场次结束前多久提醒（默认15分钟）</p>
            {errors.reminderMinutesBeforeEnd && (
              <p className="text-xs text-red-500 mt-1">{errors.reminderMinutesBeforeEnd}</p>
            )}
          </div>

          <div>
            <label className="label">
              超时计费单位 <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {unitOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    form.overtimeUnit === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="overtimeUnit"
                    value={opt.value}
                    checked={form.overtimeUnit === opt.value}
                    onChange={() => setForm({ ...form, overtimeUnit: opt.value })}
                    className="sr-only"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 mt-6 pt-6">
          <label className="label mb-3">
            超时计费方式 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  form.overtimeMode === opt.value
                    ? 'border-primary-500 bg-primary-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="overtimeMode"
                    value={opt.value}
                    checked={form.overtimeMode === opt.value}
                    onChange={() => setForm({ ...form, overtimeMode: opt.value })}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-slate-800">{opt.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-4 w-full md:w-1/2">
            <label className="label">
              {form.overtimeMode === 'ratio' ? '超时倍率' : '超时固定单价(元/小时)'}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              {form.overtimeMode === 'ratio' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ×
                </span>
              )}
              <input
                type="number"
                min={form.overtimeMode === 'ratio' ? 0.5 : 0}
                max={form.overtimeMode === 'ratio' ? 5 : 1000}
                step={form.overtimeMode === 'ratio' ? 0.1 : 1}
                className={`input ${form.overtimeMode === 'ratio' ? 'pl-8' : ''} ${
                  errors.overtimeRate ? 'border-red-400' : ''
                }`}
                value={form.overtimeRate}
                onChange={(e) => setForm({ ...form, overtimeRate: Number(e.target.value) })}
              />
              {form.overtimeMode === 'ratio' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  倍
                </span>
              )}
              {form.overtimeMode === 'fixed' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  元/时
                </span>
              )}
            </div>
            {errors.overtimeRate && (
              <p className="text-xs text-red-500 mt-1">{errors.overtimeRate}</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-slate-800">计费模拟测试</h3>
          <button className="btn btn-accent btn-sm" onClick={runSimulation}>
            <Calculator className="w-4 h-4" />
            计算演示
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="label">基础单价(元/小时)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={simBasePrice}
              onChange={(e) => setSimBasePrice(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">预订时长(分钟)</label>
            <input
              type="number"
              min={0}
              className="input"
              value={simMinutes}
              onChange={(e) => setSimMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">超时分钟数</label>
            <input
              type="number"
              min={0}
              className="input"
              value={simOvertime}
              onChange={(e) => setSimOvertime(Number(e.target.value))}
            />
          </div>
        </div>

        {simResult ? (
          <div className="bg-slate-50 rounded-xl p-5 space-y-3">
            <h4 className="font-medium text-slate-700">计算结果：</h4>
            <div className="space-y-1.5">
              {simResult.steps.map((s, i) => (
                <p key={i} className="text-sm text-slate-600 pl-2 border-l-2 border-primary-200">
                  {s}
                </p>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-3 mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-500">包厢费</p>
                <p className="text-lg font-bold text-slate-800 mt-1">
                  {formatMoney(simResult.roomFee)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">超时费</p>
                <p className="text-lg font-bold text-accent-600 mt-1">
                  {formatMoney(simResult.fee)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">合计应收</p>
                <p className="text-lg font-bold text-primary-700 mt-1">
                  {formatMoney(simResult.total)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400">
            填写参数后点击"计算演示"查看计费流程
          </div>
        )}
      </div>
    </div>
  );
}

export default function PricingSettings() {
  return (
    <AdminGuard>
      <PricingContent />
    </AdminGuard>
  );
}
