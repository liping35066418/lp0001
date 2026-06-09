import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle,
  History,
  ExternalLink,
  FileText,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Session, PagedResult } from '../../shared/api-types';
import { formatDateTime, formatMoney, formatMinutes } from '@/utils/format';
import { cn } from '@/lib/utils';
import SessionCard from '@/components/session/SessionCard';
import AddGoodsModal from '@/components/session/AddGoodsModal';
import RentBoardgameModal from '@/components/session/RentBoardgameModal';
import ExtendModal from '@/components/session/ExtendModal';
import Empty from '@/components/Empty';

type TabType = 'active' | 'completed';

interface HistoryItem {
  id: number;
  roomId: number;
  roomName?: string;
  customerName?: string;
  startAt: string;
  actualEndAt?: string;
  scheduledEndAt: string;
  elapsedMinutes: number;
  totalAmount: number;
  createdBy: number;
  billId?: number;
  billNo?: string;
}

export default function SessionList() {
  const navigate = useNavigate();
  const pushToast = useUIStore((s) => s.pushToast);

  const [tab, setTab] = useState<TabType>('active');
  const [activeSessions, setActiveSessions] = useState<Session.SessionDetail[]>(
    []
  );
  const [history, setHistory] = useState<PagedResult<HistoryItem>>({
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [loading, setLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  const [addGoodsModal, setAddGoodsModal] = useState<{
    open: boolean;
    data: Session.SessionDetail | null;
  }>({ open: false, data: null });

  const [rentModal, setRentModal] = useState<{
    open: boolean;
    data: Session.SessionDetail | null;
  }>({ open: false, data: null });

  const [extendModal, setExtendModal] = useState<{
    open: boolean;
    data: Session.SessionDetail | null;
  }>({ open: false, data: null });

  const fetchActive = useCallback(async () => {
    try {
      setLoading(true);
      const list = await get<Session.SessionDetail[]>('/sessions/active');
      setActiveSessions(list);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(historyPage),
        pageSize: '20',
      });
      const data = await get<PagedResult<HistoryItem>>(
        `/sessions/completed?${params.toString()}`
      );
      setHistory(data);
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [historyPage, pushToast]);

  useEffect(() => {
    if (tab === 'active') fetchActive();
    else fetchHistory();
  }, [tab, fetchActive, fetchHistory]);

  useEffect(() => {
    if (tab === 'active') {
      const timer = setInterval(fetchActive, 60000);
      return () => clearInterval(timer);
    }
  }, [tab, fetchActive]);

  const handleRefreshAll = async () => {
    try {
      const results = await Promise.all(
        activeSessions.map((s) =>
          post<Session.SessionDetail>(`/sessions/${s.id}/refresh-fees`)
        )
      );
      setActiveSessions(results);
      pushToast('费用已刷新', 'success');
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  const handleRefreshOne = async (s: Session.SessionDetail) => {
    try {
      const updated = await post<Session.SessionDetail>(
        `/sessions/${s.id}/refresh-fees`
      );
      setActiveSessions((prev) =>
        prev.map((x) => (x.id === s.id ? updated : x))
      );
      pushToast('费用已刷新', 'success');
    } catch (e) {
      pushToast((e as Error).message, 'error');
    }
  };

  const activeCount = activeSessions.length;
  const overtimeCount = activeSessions.filter(
    (s) => s.overtimeMinutes > 0
  ).length;

  const totalActiveAmount = activeSessions.reduce(
    (sum, s) => sum + (s.totalAmount || 0),
    0
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">场次运营</h1>
          <p className="text-sm text-slate-500 mt-1">
            管理进行中的包间场次和消费记录
          </p>
        </div>
        {tab === 'active' && activeSessions.length > 0 && (
          <button
            className="btn-outline btn-sm"
            onClick={handleRefreshAll}
          >
            <RefreshCw size={14} />
            刷新全部费用
          </button>
        )}
      </div>

      {tab === 'active' && activeSessions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="进行中场次"
            value={activeCount}
            suffix="场"
            icon={<PlayCircle size={18} />}
            color="primary"
          />
          <StatCard
            label="超时场次"
            value={overtimeCount}
            suffix="场"
            icon={<Zap size={18} />}
            color="red"
            warn={overtimeCount > 0}
          />
          <StatCard
            label="当前应收"
            value={formatMoney(totalActiveAmount)}
            icon={<FileText size={18} />}
            color="accent"
          />
          <StatCard
            label="平均时长"
            value={
              activeCount > 0
                ? formatMinutes(
                    Math.round(
                      activeSessions.reduce(
                        (sum, s) => sum + s.elapsedMinutes,
                        0
                      ) / activeCount
                    )
                  )
                : '-'
            }
            icon={<History size={18} />}
            color="slate"
          />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center border-b border-slate-100 px-1">
          <TabButton
            active={tab === 'active'}
            onClick={() => setTab('active')}
            icon={<PlayCircle size={16} />}
            label="进行中场次"
            badge={activeCount}
            badgeColor="accent"
          />
          <TabButton
            active={tab === 'completed'}
            onClick={() => setTab('completed')}
            icon={<History size={16} />}
            label="已结束场次"
          />
        </div>

        <div className="p-5">
          {tab === 'active' ? (
            loading ? (
              <ActiveSessionsSkeleton />
            ) : activeSessions.length === 0 ? (
              <Empty
                text="暂无进行中的场次"
                hint="从预约管理选择顾客开台，或直接创建新场次"
              />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {activeSessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onAddGoods={(data) =>
                      setAddGoodsModal({ open: true, data })
                    }
                    onRentBoardgame={(data) =>
                      setRentModal({ open: true, data })
                    }
                    onExtend={(data) =>
                      setExtendModal({ open: true, data })
                    }
                    onRefresh={handleRefreshOne}
                    onCheckout={(data) => navigate(`/checkout/${data.id}`)}
                  />
                ))}
              </div>
            )
          ) : (
            loading ? (
              <HistorySkeleton />
            ) : (
              <HistoryTable
                data={history}
                onPageChange={(p) => setHistoryPage(p)}
                onBillClick={(billId) => navigate(`/history/bills`)}
              />
            )
          )}
        </div>
      </div>

      <AddGoodsModal
        open={addGoodsModal.open}
        session={addGoodsModal.data}
        onClose={() => setAddGoodsModal({ open: false, data: null })}
        onSuccess={fetchActive}
      />

      <RentBoardgameModal
        open={rentModal.open}
        session={rentModal.data}
        onClose={() => setRentModal({ open: false, data: null })}
        onSuccess={fetchActive}
      />

      <ExtendModal
        open={extendModal.open}
        session={extendModal.data}
        onClose={() => setExtendModal({ open: false, data: null })}
        onSuccess={fetchActive}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  color,
  warn,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ReactNode;
  color: 'primary' | 'accent' | 'red' | 'slate';
  warn?: boolean;
}) {
  const colorMap = {
    primary: 'text-primary-600 bg-primary-50',
    accent: 'text-accent-600 bg-accent-50',
    red: 'text-red-600 bg-red-50',
    slate: 'text-slate-600 bg-slate-50',
  };
  return (
    <div className="card p-4 flex items-center gap-4">
      <div
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
          colorMap[color]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{label}</div>
        <div
          className={cn(
            'text-xl font-bold tabular-nums truncate',
            warn ? 'text-red-600' : 'text-slate-800'
          )}
        >
          {typeof value === 'number' && suffix ? `${value}${suffix}` : value}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: 'accent' | 'red';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-5 py-3.5 flex items-center gap-2 text-sm font-medium transition-all border-b-2 -mb-px',
        active
          ? 'text-primary-600 border-primary-600 bg-primary-50/30'
          : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
      )}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'badge',
            badgeColor === 'red'
              ? 'bg-red-100 text-red-700'
              : 'bg-accent-100 text-accent-700'
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function HistoryTable({
  data,
  onPageChange,
  onBillClick,
}: {
  data: PagedResult<HistoryItem>;
  onPageChange: (p: number) => void;
  onBillClick: (billId: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-5 py-3 text-left font-medium whitespace-nowrap">
                场次号
              </th>
              <th className="px-5 py-3 text-left font-medium whitespace-nowrap">
                包厢
              </th>
              <th className="px-5 py-3 text-left font-medium whitespace-nowrap">
                顾客
              </th>
              <th className="px-5 py-3 text-left font-medium whitespace-nowrap">
                起止时间
              </th>
              <th className="px-5 py-3 text-right font-medium whitespace-nowrap">
                时长
              </th>
              <th className="px-5 py-3 text-right font-medium whitespace-nowrap">
                总金额
              </th>
              <th className="px-5 py-3 text-left font-medium whitespace-nowrap">
                操作员
              </th>
              <th className="px-5 py-3 text-left font-medium whitespace-nowrap">
                账单
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12">
                  <Empty text="暂无已结束的场次记录" />
                </td>
              </tr>
            ) : (
              data.list.map((h) => (
                <tr
                  key={h.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">
                    #{String(h.id).padStart(6, '0')}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-800">
                      {h.roomName || `#${h.roomId}`}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {h.customerName || (
                      <span className="text-slate-400">散客</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-slate-700">{formatDateTime(h.startAt)}</div>
                    <div className="text-slate-400 text-xs">
                      至 {formatDateTime(h.actualEndAt || h.scheduledEndAt)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {formatMinutes(h.elapsedMinutes)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-semibold text-accent-600 tabular-nums">
                      {formatMoney(h.totalAmount)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    #{h.createdBy}
                  </td>
                  <td className="px-5 py-3">
                    {h.billNo ? (
                      <button
                        onClick={() => h.billId && onBillClick(h.billId)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium"
                      >
                        <FileText size={12} />
                        {h.billNo}
                        <ExternalLink size={10} />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-slate-100">
          <span className="text-sm text-slate-500">
            共 {data.total} 条记录
          </span>
          <div className="flex items-center gap-1">
            <button
              className="btn-sm btn-outline"
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
            >
              上一页
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i + 1;
              } else if (data.page <= 4) {
                p = i + 1;
              } else if (data.page >= totalPages - 3) {
                p = totalPages - 6 + i;
              } else {
                p = data.page - 3 + i;
              }
              return (
                <button
                  key={p}
                  className={cn(
                    'btn-sm',
                    p === data.page ? 'btn-primary' : 'btn-ghost'
                  )}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="btn-sm btn-outline"
              disabled={data.page >= totalPages}
              onClick={() => onPageChange(data.page + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveSessionsSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {[...Array(2)].map((_, i) => (
        <div
          key={i}
          className="card overflow-hidden animate-pulse-soft"
        >
          <div className="h-20 bg-slate-100" />
          <div className="p-5 space-y-3">
            <div className="h-24 bg-slate-100 rounded-lg" />
            <div className="h-10 bg-slate-100 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3 animate-pulse-soft">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-12 bg-slate-100 rounded-lg" />
      ))}
    </div>
  );
}
