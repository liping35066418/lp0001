import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  X,
  RotateCcw,
  Clock,
  Dice6,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowLeftRight,
  Receipt,
  User,
} from 'lucide-react';
import type { Rental as RT } from '../../shared/api-types';
import { get, put } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { formatMoney, formatDateTime, formatMinutes } from '@/utils/format';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

type TabType = 'active' | 'history';

const statusConfig: Record<RT.Status, { label: string; color: string; icon?: typeof CheckCircle2 }> = {
  active: { label: '进行中', color: 'bg-blue-100 text-blue-700', icon: Clock },
  returned: { label: '正常归还', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  damaged: { label: '损坏', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  lost: { label: '丢失', color: 'bg-red-100 text-red-700', icon: XCircle },
};

function RentalNo({ id }: { id: number }) {
  return <span className="font-mono text-sm text-slate-600">R{String(id).padStart(6, '0')}</span>;
}

export default function RentalList() {
  const navigate = useNavigate();
  const { pushToast, pushLoading, popLoading } = useUIStore();

  const [tab, setTab] = useState<TabType>('active');
  const [loading, setLoading] = useState(false);
  const [activeList, setActiveList] = useState<RT.Rental[]>([]);
  const [historyList, setHistoryList] = useState<RT.Rental[]>([]);

  const [returnTarget, setReturnTarget] = useState<RT.Rental | null>(null);
  const [returnChecked, setReturnChecked] = useState<Record<string, boolean>>({});
  const [damageFee, setDamageFee] = useState(0);
  const [returnRemark, setReturnRemark] = useState('');
  const [returning, setReturning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    pushLoading();
    try {
      const [active, history] = await Promise.all([
        get<RT.Rental[]>('/rentals', { params: { status: 'active' } }),
        get<RT.Rental[]>('/rentals', { params: { status: 'in,returned,damaged,lost' } }),
      ]);
      setActiveList(active);
      setHistoryList(history.filter((r) => r.status !== 'active'));
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      popLoading();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const accessoriesList = useMemo(() => {
    if (!returnTarget?.accessoriesChecked) return [] as string[];
    return returnTarget.accessoriesChecked
      .split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [returnTarget]);

  const openReturn = (r: RT.Rental) => {
    setReturnTarget(r);
    setDamageFee(0);
    setReturnRemark('');
    const init: Record<string, boolean> = {};
    r.accessoriesChecked
      ?.split(/[,，、\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((a) => {
        init[a] = true;
      });
    setReturnChecked(init);
  };

  const allChecked = accessoriesList.every((a) => returnChecked[a]);

  const refundAmount = Math.max(0, (returnTarget?.depositCollected || 0) - damageFee);

  const handleReturn = async () => {
    if (!returnTarget) return;
    if (!allChecked) {
      pushToast('请确认所有配件已归还', 'warn');
      return;
    }
    if (damageFee < 0) {
      pushToast('损坏费不能为负', 'warn');
      return;
    }
    setReturning(true);
    pushLoading();
    try {
      const returnedItems = Object.entries(returnChecked)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join('、');
      await put(`/rentals/${returnTarget.id}/return`, {
        accessoriesReturned: returnedItems || '全部归还',
        damageFee: Number(damageFee),
        remark: returnRemark.trim(),
      });
      pushToast('归还成功', 'success');
      setReturnTarget(null);
      fetchData();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setReturning(false);
      popLoading();
    }
  };

  const elapsed = (rentedAt: string) => {
    const diff = dayjs().diff(dayjs(rentedAt), 'minute');
    return formatMinutes(diff);
  };

  const renderActiveTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-slate-500">
            <th className="text-left font-medium px-4 py-3">租借单号</th>
            <th className="text-left font-medium px-4 py-3">场次/包厢</th>
            <th className="text-left font-medium px-4 py-3">桌游名称</th>
            <th className="text-right font-medium px-4 py-3">押金</th>
            <th className="text-right font-medium px-4 py-3">租借费</th>
            <th className="text-left font-medium px-4 py-3">借出时间</th>
            <th className="text-left font-medium px-4 py-3">已用时长</th>
            <th className="text-left font-medium px-4 py-3">状态</th>
            <th className="text-right font-medium px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {activeList.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>暂无进行中的租借</p>
              </td>
            </tr>
          ) : (
            activeList.map((r) => {
              const cfg = statusConfig[r.status];
              const Icon = cfg.icon || Clock;
              return (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3">
                    <RentalNo id={r.id} />
                  </td>
                  <td className="px-4 py-3">
                    {r.sessionRoomName ? (
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <Receipt className="w-3.5 h-3.5 text-primary-600" />
                        {r.sessionRoomName}
                      </span>
                    ) : r.customerName ? (
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <User className="w-3.5 h-3.5 text-accent-600" />
                        {r.customerName}
                      </span>
                    ) : (
                      <span className="text-slate-400">散客租借</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800 flex items-center gap-1.5">
                      <Dice6 className="w-4 h-4 text-primary-500" />
                      {r.boardgameName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-accent-600">
                    {formatMoney(r.depositCollected)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-primary-600">
                    {formatMoney(r.rentalFee)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(r.rentedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{elapsed(r.rentedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', cfg.color)}>
                      <Icon className="w-3 h-3 mr-1" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-accent btn-sm"
                      onClick={() => openReturn(r)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      归还
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const renderHistoryTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-slate-500">
            <th className="text-left font-medium px-4 py-3">租借单号</th>
            <th className="text-left font-medium px-4 py-3">场次/包厢</th>
            <th className="text-left font-medium px-4 py-3">桌游名称</th>
            <th className="text-right font-medium px-4 py-3">押金</th>
            <th className="text-right font-medium px-4 py-3">租借费</th>
            <th className="text-left font-medium px-4 py-3">借出时间</th>
            <th className="text-left font-medium px-4 py-3">归还时间</th>
            <th className="text-left font-medium px-4 py-3">状态</th>
            <th className="text-right font-medium px-4 py-3">损坏费</th>
            <th className="text-right font-medium px-4 py-3">实退押金</th>
          </tr>
        </thead>
        <tbody>
          {historyList.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>暂无归还记录</p>
              </td>
            </tr>
          ) : (
                historyList.map((r) => {
                  const cfg = statusConfig[r.status];
                  const Icon = cfg.icon || CheckCircle2;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <RentalNo id={r.id} />
                      </td>
                      <td className="px-4 py-3">
                        {r.sessionRoomName || r.customerName || (
                          <span className="text-slate-400">散客租借</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">
                          {r.boardgameName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-accent-600">
                        {formatMoney(r.depositCollected)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-primary-600">
                        {formatMoney(r.rentalFee)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDateTime(r.rentedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.returnedAt ? formatDateTime(r.returnedAt) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge', cfg.color)}>
                          <Icon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right font-medium',
                          r.damageFee > 0 ? 'text-orange-600' : 'text-slate-400'
                        )}
                      >
                        {r.damageFee > 0 ? formatMoney(r.damageFee) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {formatMoney(r.depositRefunded)}
                      </td>
                    </tr>
                  );
                })
              )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">租借归还</h1>
          <p className="text-sm text-slate-500 mt-1">桌游租借和归还管理</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/rentals/new')}
        >
          <Plus className="w-4 h-4" />
          新增租借
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-slate-100">
          {[
            { k: 'active', label: '租借中', count: activeList.length },
            { k: 'history', label: '归还记录', count: historyList.length },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as TabType)}
              className={cn(
                'px-6 py-3 text-sm font-medium relative transition-colors',
                tab === t.k
                  ? 'text-primary-700'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    'ml-2 px-2 py-0.5 rounded-full text-xs',
                    tab === t.k
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {t.count}
                </span>
              )}
              {tab === t.k && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />
              )}
            </button>
          ))}
        </div>

        <div className="p-2">
          {loading && tab === 'active' && activeList.length === 0 ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
          ) : tab === 'active' ? (
            renderActiveTable()
          ) : loading && historyList.length === 0 ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
          ) : (
            renderHistoryTable()
          )}
        </div>
      </div>

      {returnTarget && (
        <div className="modal-backdrop" onClick={() => setReturnTarget(null)}>
          <div
            className="modal max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  归还桌游 - {returnTarget.boardgameName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  单号 <RentalNo id={returnTarget.id} />
                </p>
              </div>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setReturnTarget(null)}
                disabled={returning}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="modal-body space-y-5">
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-xs text-slate-500">押金</div>
                  <div className="text-lg font-bold text-accent-600">
                    {formatMoney(returnTarget.depositCollected)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">借出时间</div>
                  <div className="text-sm font-medium text-slate-700">
                    {formatDateTime(returnTarget.rentedAt)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">已用时长</div>
                  <div className="text-sm font-medium text-slate-700">
                    {elapsed(returnTarget.rentedAt)}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-primary-600" />
                  配件核对（借出时清单）
                </h4>
                {accessoriesList.length === 0 ? (
                  <p className="text-sm text-slate-400">此桌游未登记配件清单</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {accessoriesList.map((acc, i) => (
                      <label
                        key={i}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                          returnChecked[acc]
                            ? 'border-green-400 bg-green-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!!returnChecked[acc]}
                          onChange={(e) =>
                            setReturnChecked((old) => ({ ...old, [acc]: e.target.checked }))
                          }
                          className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                        />
                        <span
                          className={cn(
                            'text-sm flex-1',
                            returnChecked[acc] ? 'text-green-700' : 'text-slate-600'
                          )}
                        >
                          {acc}
                        </span>
                        {returnChecked[acc] && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {accessoriesList.length > 0 && !allChecked && (
                  <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    未勾选的配件将视为丢失或损坏
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">损坏费（元）</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ￥
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={damageFee}
                      onChange={(e) => setDamageFee(Number(e.target.value))}
                      className="input pl-7"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">应退押金</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      ￥
                    </span>
                    <div className="input pl-7 bg-green-50 border-green-200 text-green-700 font-semibold">
                      {refundAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">备注</label>
                <textarea
                  value={returnRemark}
                  onChange={(e) => setReturnRemark(e.target.value)}
                  placeholder="异常情况说明..."
                  rows={2}
                  className="input resize-y"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-outline"
                onClick={() => setReturnTarget(null)}
                disabled={returning}
              >
                取消
              </button>
              <button
                className="btn-accent"
                onClick={handleReturn}
                disabled={returning}
              >
                {returning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    归还中...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-4 h-4" />
                    确认归还（退{formatMoney(refundAmount)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
