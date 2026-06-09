import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Image,
  AlertCircle,
  Loader2,
  Dice6,
} from 'lucide-react';
import type { Boardgame as BG } from '../../shared/api-types';
import { get, post, put } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const PRESET_CATEGORIES = ['策略', '卡牌', '聚会', '推理', '亲子', '抽象', '合作', '儿童', '其他'];
const DIFFICULTY_OPTIONS: { value: BG.Difficulty; label: string; desc: string; color: string }[] = [
  { value: 'easy', label: '简单', desc: '入门级，5分钟学会', color: 'border-green-500 bg-green-50 text-green-700' },
  { value: 'medium', label: '中等', desc: '标准规则，10分钟学会', color: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'hard', label: '困难', desc: '进阶策略，30分钟学会', color: 'border-orange-500 bg-orange-50 text-orange-700' },
  { value: 'expert', label: '专家', desc: '重度策略，1小时+学会', color: 'border-red-500 bg-red-50 text-red-700' },
];

export default function BoardgameForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const { user } = useAuthStore();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '',
    coverImage: '',
    category: '',
    difficulty: 'easy' as BG.Difficulty,
    minPlayers: 2,
    maxPlayers: 4,
    playMinutes: 60,
    accessories: '',
    deposit: 50,
    rentalFee: 20,
    stockTotal: 1,
    remark: '',
  });

  useEffect(() => {
    if (!isEdit) return;
    const fetch = async () => {
      setLoading(true);
      pushLoading();
      try {
        const data = await get<BG.Boardgame>(`/boardgames/${id}`);
        setForm({
          name: data.name,
          coverImage: data.coverImage || '',
          category: data.category,
          difficulty: data.difficulty,
          minPlayers: data.minPlayers,
          maxPlayers: data.maxPlayers,
          playMinutes: data.playMinutes,
          accessories: data.accessories || '',
          deposit: data.deposit,
          rentalFee: data.rentalFee,
          stockTotal: data.stockTotal,
          remark: data.remark || '',
        });
      } catch (e) {
        pushToast((e as Error).message, 'error');
      } finally {
        setLoading(false);
        popLoading();
      }
    };
    fetch();
  }, [id, isEdit]);

  if (user?.role !== 'admin') {
    return <Navigate to="/boardgames" replace />;
  }

  const update = <K extends keyof typeof form>(key: K, val: typeof form[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key as string]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key as string];
        return n;
      });
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = '请输入桌游名称';
    if (!form.category.trim()) e.category = '请输入分类';
    if (!form.difficulty) e.difficulty = '请选择难度';
    if (form.minPlayers < 1) e.minPlayers = '最少人数至少为1';
    if (form.maxPlayers < form.minPlayers) e.maxPlayers = '最多人数不能少于最少人数';
    if (form.playMinutes < 5) e.playMinutes = '一局时长至少5分钟';
    if (form.deposit < 0) e.deposit = '押金不能为负';
    if (form.rentalFee < 0) e.rentalFee = '租借费不能为负';
    if (form.stockTotal < 1) e.stockTotal = '总库存至少为1';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      pushToast('请检查表单填写', 'warn');
      return;
    }
    setSubmitting(true);
    pushLoading();
    try {
      const payload = {
        name: form.name.trim(),
        coverImage: form.coverImage.trim(),
        category: form.category.trim(),
        difficulty: form.difficulty,
        minPlayers: Number(form.minPlayers),
        maxPlayers: Number(form.maxPlayers),
        playMinutes: Number(form.playMinutes),
        accessories: form.accessories.trim(),
        deposit: Number(form.deposit),
        rentalFee: Number(form.rentalFee),
        stockTotal: Number(form.stockTotal),
        stockAvailable: isEdit ? undefined : Number(form.stockTotal),
        remark: form.remark.trim(),
      };
      if (isEdit) {
        await put(`/boardgames/${id}`, payload);
        pushToast('桌游档案更新成功', 'success');
      } else {
        await post('/boardgames', payload);
        pushToast('桌游档案创建成功', 'success');
      }
      navigate('/boardgames', { replace: true });
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
      popLoading();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-6 bg-slate-100 rounded w-24" />
        </div>
        <div className="card p-6 space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse-soft">
              <div className="h-4 bg-slate-100 rounded w-20" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          className="btn-ghost btn-sm"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? '编辑桌游' : '新增桌游'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEdit ? '修改桌游档案信息' : '录入新的桌游资料'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6 lg:col-span-2">
            <div>
              <label className="label">
                桌游名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="例如：卡坦岛"
                className={cn('input', errors.name && 'border-red-500 focus:ring-red-500')}
                maxLength={100}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label className="label">封面图 URL（可选）</label>
              <div className="flex gap-3 flex-col sm:flex-row">
                <div className="flex-1">
                  <input
                    type="url"
                    value={form.coverImage}
                    onChange={(e) => update('coverImage', e.target.value)}
                    placeholder="https://..."
                    className="input"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    不填则使用首字母彩色占位图
                  </p>
                </div>
                <div className="w-32 h-24 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex-shrink-0 flex items-center justify-center">
                  {form.coverImage ? (
                    <img
                      src={form.coverImage}
                      alt="预览"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : form.name ? (
                    <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-3xl font-bold">
                      {form.name.charAt(0)}
                    </div>
                  ) : (
                    <Image className="w-8 h-8 text-slate-300" />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                分类 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="输入或选择下方分类"
                className={cn('input mb-2', errors.category && 'border-red-500 focus:ring-red-500')}
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update('category', c)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors border',
                      form.category === c
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {errors.category && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="label">
                难度 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <label
                    key={d.value}
                    className={cn(
                      'relative cursor-pointer rounded-xl border-2 p-3 transition-all',
                      form.difficulty === d.value
                        ? d.color + ' border-2 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                    )}
                  >
                    <input
                      type="radio"
                      name="difficulty"
                      value={d.value}
                      checked={form.difficulty === d.value}
                      onChange={() => update('difficulty', d.value)}
                      className="sr-only"
                    />
                    <div className="text-sm font-semibold">{d.label}</div>
                    <div className="text-xs mt-0.5 opacity-75">{d.desc}</div>
                  </label>
                ))}
              </div>
              {errors.difficulty && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.difficulty}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  最少人数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.minPlayers}
                  onChange={(e) => update('minPlayers', Number(e.target.value))}
                  className={cn('input', errors.minPlayers && 'border-red-500 focus:ring-red-500')}
                />
                {errors.minPlayers && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.minPlayers}
                  </p>
                )}
              </div>
              <div>
                <label className="label">
                  最多人数 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.maxPlayers}
                  onChange={(e) => update('maxPlayers', Number(e.target.value))}
                  className={cn('input', errors.maxPlayers && 'border-red-500 focus:ring-red-500')}
                />
                {errors.maxPlayers && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.maxPlayers}
                  </p>
                )}
              </div>
              <div>
                <label className="label">一局时长（分钟）</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={form.playMinutes}
                  onChange={(e) => update('playMinutes', Number(e.target.value))}
                  className={cn('input', errors.playMinutes && 'border-red-500 focus:ring-red-500')}
                />
                {errors.playMinutes && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.playMinutes}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label">配件清单</label>
              <textarea
                value={form.accessories}
                onChange={(e) => update('accessories', e.target.value)}
                placeholder="用逗号、顿号或换行分隔，例如：棋盘x1，骰子x2，棋子x20，说明书x1"
                rows={4}
                className="input resize-y"
              />
              <p className="mt-1 text-xs text-slate-500">
                借出和归还时会按此清单核对
              </p>
            </div>

            <div>
              <label className="label">备注</label>
              <textarea
                value={form.remark}
                onChange={(e) => update('remark', e.target.value)}
                placeholder="其他说明信息..."
                rows={3}
                className="input resize-y"
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-5 bg-gradient-to-br from-primary-50 to-white border-primary-100">
              <div className="flex items-center gap-2 mb-4">
                <Dice6 className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-slate-800">费用与库存</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">
                    押金（元） <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ￥
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.deposit}
                      onChange={(e) => update('deposit', Number(e.target.value))}
                      className={cn(
                        'input pl-7 text-lg font-semibold',
                        errors.deposit && 'border-red-500 focus:ring-red-500'
                      )}
                    />
                  </div>
                  {errors.deposit && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.deposit}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">
                    租借费/场（元） <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ￥
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.rentalFee}
                      onChange={(e) => update('rentalFee', Number(e.target.value))}
                      className={cn(
                        'input pl-7 text-lg font-semibold',
                        errors.rentalFee && 'border-red-500 focus:ring-red-500'
                      )}
                    />
                  </div>
                  {errors.rentalFee && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.rentalFee}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">
                    总库存 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.stockTotal}
                    onChange={(e) => update('stockTotal', Number(e.target.value))}
                    className={cn(
                      'input text-lg font-semibold',
                      errors.stockTotal && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                  {isEdit && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      编辑模式下仅修改总库存，不会改变可用库存
                    </p>
                  )}
                  {errors.stockTotal && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.stockTotal}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn-outline flex-1"
                onClick={() => navigate(-1)}
                disabled={submitting}
              >
                取消
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isEdit ? '保存修改' : '创建档案'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
