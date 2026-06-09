import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Search,
  Dice6,
  Package,
  AlertCircle,
  Loader2,
  Receipt,
  Users,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { Boardgame as BG, Session as SS } from '../../shared/api-types';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { formatMoney, cnDifficulty, difficultyColor, formatDateTime } from '@/utils/format';
import { cn } from '@/lib/utils';

export default function RentalForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const preselectBoardgameId = (location.state as { boardgameId?: number } | null)?.boardgameId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [boardgames, setBoardgames] = useState<BG.Boardgame[]>([]);
  const [sessions, setSessions] = useState<SS.Session[]>([]);
  const [bgSearch, setBgSearch] = useState('');
  const [showBgPicker, setShowBgPicker] = useState(false);

  const [sessionId, setSessionId] = useState<number | ''>('');
  const [boardgameId, setBoardgameId] = useState<number | null>(null);
  const [deposit, setDeposit] = useState(0);
  const [accessoriesChecked, setAccessoriesChecked] = useState<Record<string, boolean>>({});
  const [remark, setRemark] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      pushLoading();
      try {
        const [bg, ss] = await Promise.all([
          get<BG.Boardgame[]>('/boardgames', { params: { status: 'active' } }),
          get<SS.Session[]>('/sessions/active'),
        ]);
        setBoardgames(bg);
        setSessions(ss);
        if (preselectBoardgameId) {
          const found = bg.find((b) => b.id === preselectBoardgameId);
          if (found) {
            setBoardgameId(found.id);
            setDeposit(found.deposit);
            const acc: Record<string, boolean> = {};
            found.accessories
              ?.split(/[,，、\n]/)
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((a) => {
                acc[a] = true;
              });
            setAccessoriesChecked(acc);
          }
        }
      } catch (e) {
        pushToast((e as Error).message, 'error');
      } finally {
        setLoading(false);
        popLoading();
      }
    };
    init();
  }, [preselectBoardgameId]);

  const selectedBg = useMemo(
    () => boardgames.find((b) => b.id === boardgameId) || null,
    [boardgames, boardgameId]
  );

  const accessoriesList = useMemo(() => {
    if (!selectedBg?.accessories) return [] as string[];
    return selectedBg.accessories
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [selectedBg]);

  const filteredBg = useMemo(() => {
    if (!bgSearch.trim()) return boardgames;
    const kw = bgSearch.toLowerCase();
    return boardgames.filter((b) => b.name.toLowerCase().includes(kw));
  }, [boardgames, bgSearch]);

  const selectBoardgame = (b: BG.Boardgame) => {
    if (b.stockAvailable <= 0) {
      pushToast('该桌游库存不足', 'warn');
      return;
    }
    setBoardgameId(b.id);
    setDeposit(b.deposit);
    const acc: Record<string, boolean> = {};
    b.accessories
      ?.split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((a) => {
        acc[a] = true;
      });
    setAccessoriesChecked(acc);
    setShowBgPicker(false);
    if (errors.boardgameId) {
      setErrors((e) => {
        const n = { ...e };
        delete n.boardgameId;
        return n;
      });
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!boardgameId) e.boardgameId = '请选择桌游';
    if (deposit < 0) e.deposit = '押金不能为负';
    if (accessoriesList.length > 0) {
      const checkedCount = Object.values(accessoriesChecked).filter(Boolean).length;
      if (checkedCount === 0) {
        e.accessories = '请勾选至少一项配件';
      }
    }
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
      const accChecked = Object.entries(accessoriesChecked)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join('、');
      await post('/rentals', {
        sessionId: sessionId === '' ? undefined : Number(sessionId),
        boardgameId: boardgameId!,
        depositCollected: Number(deposit),
        accessoriesChecked: accChecked || '无配件',
        remark: remark.trim(),
      });
      pushToast('租借创建成功', 'success');
      navigate('/rentals', { replace: true });
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
          {Array.from({ length: 5 }).map((_, i) => (
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
          <h1 className="text-2xl font-bold text-slate-800">新建租借</h1>
          <p className="text-sm text-slate-500 mt-1">创建桌游租借记录</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6 space-y-6">
            <div>
              <label className="label">关联场次（可选）</label>
              <select
                value={sessionId}
                onChange={(e) =>
                  setSessionId(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="input"
              >
                <option value="">不关联场次（散客租借）</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.roomName} - {s.customerName || `场次#${s.id}`}（{formatDateTime(s.startAt)}开始）
                  </option>
                ))}
              </select>
              {sessions.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">暂无进行中的场次</p>
              )}
            </div>

            <div className="relative">
              <label className="label">
                选择桌游 <span className="text-red-500">*</span>
              </label>
              <div
                className="cursor-pointer"
                onClick={() => setShowBgPicker((v) => !v)}
              >
                {selectedBg ? (
                  <div className="input flex items-center gap-3 h-auto py-3">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                      {selectedBg.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800">
                        {selectedBg.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn('badge', difficultyColor(selectedBg.difficulty))}>
                          {cnDifficulty(selectedBg.difficulty)}
                        </span>
                        <span className="badge bg-slate-100 text-slate-600">
                          <Users className="w-3 h-3 mr-1" />
                          {selectedBg.minPlayers}-{selectedBg.maxPlayers}人
                        </span>
                        <span className="badge bg-slate-100 text-slate-600">
                          <Clock className="w-3 h-3 mr-1" />
                          {selectedBg.playMinutes}分钟
                        </span>
                        <span
                          className={cn(
                            'badge font-semibold',
                            selectedBg.stockAvailable > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          库存 {selectedBg.stockAvailable}/{selectedBg.stockTotal}
                        </span>
                      </div>
                    </div>
                    <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </div>
                ) : (
                  <div className="input flex items-center gap-2 text-slate-400">
                    <Dice6 className="w-4 h-4" />
                    <span>点击选择桌游...</span>
                  </div>
                )}
              </div>
              {errors.boardgameId && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.boardgameId}
                </p>
              )}

              {showBgPicker && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white z-10">
                  <div className="p-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={bgSearch}
                        onChange={(e) => setBgSearch(e.target.value)}
                        placeholder="搜索桌游名称..."
                        className="input pl-10"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {filteredBg.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm">
                        未找到桌游
                      </div>
                    ) : (
                      filteredBg.map((b) => {
                        const soldOut = b.stockAvailable <= 0;
                        const selected = b.id === boardgameId;
                        return (
                          <div
                            key={b.id}
                            onClick={() => !soldOut && selectBoardgame(b)}
                            className={cn(
                              'px-4 py-3 border-b border-slate-50 flex items-center gap-3 transition-colors',
                              soldOut
                                ? 'opacity-50 cursor-not-allowed bg-slate-50'
                                : selected
                                ? 'bg-primary-50 cursor-pointer'
                                : 'hover:bg-slate-50 cursor-pointer'
                            )}
                          >
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {b.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 text-sm">
                                {b.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className={cn('badge', difficultyColor(b.difficulty))}>
                                  {cnDifficulty(b.difficulty)}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {b.minPlayers}-{b.maxPlayers}人
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-semibold text-primary-600">
                                {formatMoney(b.rentalFee)}/场
                              </div>
                              <div
                                className={cn(
                                  'text-xs mt-0.5',
                                  soldOut ? 'text-red-500' : 'text-green-600'
                                )}
                              >
                                {soldOut ? '暂无库存' : `剩${b.stockAvailable}件`}
                              </div>
                            </div>
                            {selected && (
                              <CheckCircle2 className="w-5 h-5 text-primary-600" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-primary-600" />
                配件核对（借出时）
              </h4>
              {!selectedBg ? (
                <p className="text-sm text-slate-400">请先选择桌游</p>
              ) : accessoriesList.length === 0 ? (
                <p className="text-sm text-slate-400">此桌游未登记配件清单</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {accessoriesList.map((acc, i) => (
                    <label
                      key={i}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer',
                        accessoriesChecked[acc]
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={!!accessoriesChecked[acc]}
                        onChange={(e) =>
                          setAccessoriesChecked((old) => ({
                            ...old,
                            [acc]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                      />
                      <span
                        className={cn(
                          'text-sm',
                          accessoriesChecked[acc]
                            ? 'text-primary-700 font-medium'
                            : 'text-slate-600'
                        )}
                      >
                        {acc}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.accessories && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.accessories}
                </p>
              )}
            </div>

            <div>
              <label className="label">备注</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="其他说明..."
                rows={3}
                className="input resize-y"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary-600" />
              费用信息
            </h3>

            {selectedBg ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">桌游名称</span>
                    <span className="font-medium text-slate-800">
                      {selectedBg.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">租借费</span>
                    <span className="font-semibold text-primary-600">
                      {formatMoney(selectedBg.rentalFee)}/场
                    </span>
                  </div>
                </div>

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
                      value={deposit}
                      onChange={(e) => setDeposit(Number(e.target.value))}
                      className={cn(
                        'input pl-7 text-lg font-semibold',
                        errors.deposit && 'border-red-500 focus:ring-red-500'
                      )}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    归还时若无损坏则全额退还
                  </p>
                  {errors.deposit && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.deposit}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">应收合计</span>
                    <span className="text-2xl font-bold text-primary-700">
                      {formatMoney((selectedBg?.rentalFee || 0) + deposit)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 text-right mt-1">
                    租借费 + 押金
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <Dice6 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">选择桌游后显示费用信息</p>
              </div>
            )}
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
                  创建中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  确认租借
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
