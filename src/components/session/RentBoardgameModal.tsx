import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Gamepad2,
  Search,
  Check,
  AlertTriangle,
  Shield,
  Package,
  ChevronRight,
} from 'lucide-react';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Boardgame, Session } from '../../../shared/api-types';
import { formatMoney, cnDifficulty, difficultyColor } from '@/utils/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  session: Session.SessionDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'select' | 'confirm';

export default function RentBoardgameModal({
  open,
  session,
  onClose,
  onSuccess,
}: Props) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [boardgames, setBoardgames] = useState<Boardgame.Boardgame[]>([]);
  const [keyword, setKeyword] = useState('');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [accessoriesChecked, setAccessoriesChecked] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchData();
      setStep('select');
      setSelectedId(null);
      setAccessoriesChecked([]);
      setKeyword('');
      setDifficulty('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await get<Boardgame.Boardgame[]>('/boardgames');
      setBoardgames(
        list.filter((b) => b.status === 'active' && b.stockAvailable > 0)
      );
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = boardgames;
    if (difficulty !== 'all') {
      list = list.filter((b) => b.difficulty === difficulty);
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(k) ||
          b.category.toLowerCase().includes(k)
      );
    }
    return list;
  }, [boardgames, difficulty, keyword]);

  const selected = selectedId
    ? boardgames.find((b) => b.id === selectedId) || null
    : null;

  const accessoriesList = useMemo(() => {
    if (!selected?.accessories) return [];
    return selected.accessories
      .split(/[,，、;；\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [selected]);

  const allAccessoriesChecked =
    accessoriesList.length === 0 ||
    accessoriesList.every((a) => accessoriesChecked.includes(a));

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setAccessoriesChecked([]);
  };

  const toggleAccessory = (acc: string) => {
    setAccessoriesChecked((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc]
    );
  };

  const handleSubmit = async () => {
    if (!selected || !session) return;
    if (!allAccessoriesChecked) {
      if (
        !confirm('配件尚未全部核对确认，确定继续租借吗？')
      )
        return;
    }
    setSubmitting(true);
    try {
      await post('/rentals', {
        sessionId: session.id,
        boardgameId: selected.id,
        depositCollected: selected.deposit,
        accessoriesChecked: accessoriesChecked.join(', '),
      });
      pushToast(`桌游「${selected.name}」租借成功！`, 'success');
      onSuccess();
      onClose();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal !max-w-4xl animate-slide-up flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header flex-shrink-0">
          <div className="flex items-center gap-3">
            <Gamepad2 size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              租借桌游
            </h2>
            <span className="text-sm text-slate-400">
              {session?.roomName} · #{session?.id}
            </span>
          </div>
          <button className="btn-sm btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-2 border-b border-slate-100 flex items-center gap-2 flex-shrink-0 bg-slate-50/50">
          <StepIndicator
            label="选择桌游"
            active={step === 'select'}
            done={step === 'confirm'}
          />
          <ChevronRight size={14} className="text-slate-300" />
          <StepIndicator
            label="配件核对"
            active={step === 'confirm'}
            done={false}
          />
        </div>

        {step === 'select' ? (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-100 flex-shrink-0 flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="搜索桌游名称或分类..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <DiffChip
                  label="全部"
                  active={difficulty === 'all'}
                  onClick={() => setDifficulty('all')}
                />
                {(['easy', 'medium', 'hard', 'expert'] as const).map((d) => (
                  <DiffChip
                    key={d}
                    label={cnDifficulty(d)}
                    active={difficulty === d}
                    onClick={() => setDifficulty(d)}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="h-28 bg-slate-100 rounded-lg animate-pulse-soft"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Gamepad2 size={40} className="mb-2 opacity-40" />
                  <p className="text-sm">暂无可用桌游</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map((b) => {
                    const isSelected = selectedId === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => handleSelect(b.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all flex gap-4',
                          isSelected
                            ? 'border-primary-500 bg-primary-50 shadow-sm'
                            : 'border-slate-200 hover:border-primary-300 hover:shadow-sm bg-white'
                        )}
                      >
                        <div className="w-20 h-24 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 overflow-hidden">
                          {b.coverImage ? (
                            <img
                              src={b.coverImage}
                              alt={b.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Gamepad2 size={28} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-slate-800 truncate">
                              {b.name}
                            </h4>
                            {isSelected && (
                              <Check
                                size={18}
                                className="text-primary-600 flex-shrink-0"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className={`badge ${difficultyColor(b.difficulty)}`}
                            >
                              {cnDifficulty(b.difficulty)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {b.category}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1.5">
                            {b.minPlayers}-{b.maxPlayers}人 · 约{b.playMinutes}分钟
                          </div>
                          <div className="mt-auto pt-2 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs">
                              <span className="flex items-center gap-1 text-accent-600 font-semibold">
                                <Shield size={12} />
                                押金{formatMoney(b.deposit)}
                              </span>
                              <span className="text-primary-600 font-medium">
                                {formatMoney(b.rentalFee)}/次
                              </span>
                            </div>
                            <span
                              className={cn(
                                'text-xs font-medium',
                                b.stockAvailable > 0
                                  ? 'text-green-600'
                                  : 'text-red-500'
                              )}
                            >
                              库存 {b.stockAvailable}/{b.stockTotal}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {selected && (
              <div className="max-w-2xl mx-auto">
                <div className="flex gap-5 p-5 bg-slate-50 rounded-xl mb-5">
                  <div className="w-28 h-36 flex-shrink-0 rounded-xl bg-white flex items-center justify-center text-slate-300 shadow-sm overflow-hidden">
                    {selected.coverImage ? (
                      <img
                        src={selected.coverImage}
                        alt={selected.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Gamepad2 size={40} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                      {selected.name}
                    </h3>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`badge ${difficultyColor(selected.difficulty)}`}>
                        {cnDifficulty(selected.difficulty)}
                      </span>
                      <span className="badge bg-slate-100 text-slate-600">
                        {selected.category}
                      </span>
                      <span className="badge bg-blue-100 text-blue-700">
                        {selected.minPlayers}-{selected.maxPlayers}人
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2.5 bg-white rounded-lg">
                        <div className="text-xs text-slate-500 mb-0.5">
                          租借费用
                        </div>
                        <div className="font-bold text-primary-600">
                          {formatMoney(selected.rentalFee)}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white rounded-lg">
                        <div className="text-xs text-slate-500 mb-0.5">
                          押金金额
                        </div>
                        <div className="font-bold text-accent-600">
                          {formatMoney(selected.deposit)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                      <Package size={16} className="text-primary-600" />
                      配件核对
                      <span className="text-xs font-normal text-slate-500">
                        （请逐一清点并勾选确认）
                      </span>
                    </h4>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        allAccessoriesChecked
                          ? 'text-green-600'
                          : 'text-amber-600'
                      )}
                    >
                      {accessoriesChecked.length}/{accessoriesList.length} 已确认
                    </span>
                  </div>

                  {accessoriesList.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-lg text-center text-sm text-slate-500">
                      该桌游未登记配件清单
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {accessoriesList.map((acc) => {
                        const checked = accessoriesChecked.includes(acc);
                        return (
                          <button
                            key={acc}
                            onClick={() => toggleAccessory(acc)}
                            className={cn(
                              'p-3 rounded-lg border-2 text-left transition-all flex items-center gap-2.5',
                              checked
                                ? 'border-green-400 bg-green-50'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            )}
                          >
                            <div
                              className={cn(
                                'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                                checked
                                  ? 'bg-green-500 border-green-500'
                                  : 'border-slate-300'
                              )}
                            >
                              {checked && (
                                <Check size={12} className="text-white" />
                              )}
                            </div>
                            <span
                              className={cn(
                                'text-sm',
                                checked
                                  ? 'text-green-800 font-medium'
                                  : 'text-slate-700'
                              )}
                            >
                              {acc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!allAccessoriesChecked && accessoriesList.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-700 mb-5">
                    <AlertTriangle
                      size={16}
                      className="flex-shrink-0 mt-0.5"
                    />
                    <span>
                      还有 {accessoriesList.length - accessoriesChecked.length}{' '}
                      项配件未核对确认，请与顾客当面清点后继续。
                    </span>
                  </div>
                )}

                {selected.remark && (
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                    <span className="text-xs text-slate-500 mr-2">备注：</span>
                    {selected.remark}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer flex-shrink-0">
          {step === 'select' ? (
            <>
              <button className="btn-outline" onClick={onClose}>
                取消
              </button>
              <button
                className="btn-primary"
                disabled={!selected}
                onClick={() => setStep('confirm')}
              >
                下一步：核对配件
                <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <>
              <button className="btn-outline" onClick={() => setStep('select')}>
                返回选择
              </button>
              <button
                className={cn(
                  'btn-primary',
                  submitting && 'opacity-70 pointer-events-none'
                )}
                onClick={handleSubmit}
                disabled={submitting}
              >
                <Shield size={16} />
                {submitting ? '确认中...' : '确认租借'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
        active
          ? 'bg-primary-100 text-primary-700 font-medium'
          : done
          ? 'text-green-600'
          : 'text-slate-400'
      )}
    >
      {done ? (
        <Check size={14} />
      ) : (
        <div
          className={cn(
            'w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
            active
              ? 'bg-primary-600 text-white'
              : 'bg-slate-200 text-slate-500'
          )}
        />
      )}
      {label}
    </div>
  );
}

function DiffChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-lg text-xs font-medium transition-all',
        active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      )}
    >
      {label}
    </button>
  );
}
