import { useState } from 'react';
import {
  Users,
  Phone,
  UserCircle2,
  Clock,
  Volume2,
  XCircle,
  CheckCircle2,
  SkipForward,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import dayjs from 'dayjs';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Queue } from '../../../shared/api-types';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/utils/format';

interface Props {
  queueData: Queue.QueueSummary | null;
  loading: boolean;
  onRefresh: () => void;
}

const STATUS_LABEL: Record<Queue.Status, { label: string; cls: string }> = {
  waiting: { label: '等待中', cls: 'bg-slate-100 text-slate-700' },
  calling: { label: '叫号中', cls: 'bg-amber-100 text-amber-700 animate-pulse' },
  skipped: { label: '已跳过', cls: 'bg-orange-100 text-orange-700' },
  seated: { label: '已入座', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', cls: 'bg-slate-100 text-slate-400' },
};

export default function QueueManagementPanel({ queueData, loading, onRefresh }: Props) {
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const runAction = async (id: number, label: string, fn: () => Promise<unknown>) => {
    setPendingAction(id);
    pushLoading();
    try {
      await fn();
      pushToast(`${label}成功`, 'success');
      onRefresh();
    } catch (e) {
      pushToast((e as Error).message || `${label}失败`, 'error');
    } finally {
      setPendingAction(null);
      popLoading();
    }
  };

  const handleCall = (item: Queue.WaitingItem) =>
    runAction(item.id, '叫号', () =>
      post(`/queue/${item.id}/call`, { roomId: item.assignedRoomId }),
    );

  const handleSkip = (item: Queue.WaitingItem) =>
    runAction(item.id, '跳过', async () => {
      await post(`/queue/${item.id}/skip`, {});
      await post('/queue/auto-call-next', {});
    });

  const handleCancel = (item: Queue.WaitingItem) =>
    runAction(item.id, '取消排队', () => post(`/queue/${item.id}/cancel`, {}));

  const handleAutoCall = () =>
    runAction(0, '自动叫号', () => post('/queue/auto-call-next', {}));

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary-500 mb-3" />
        <p className="text-sm text-slate-500">加载队列中...</p>
      </div>
    );
  }

  if (!queueData || queueData.list.length === 0) {
    return (
      <div className="card p-10 text-center">
        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 mb-1">当前暂无等位客人</p>
        <p className="text-xs text-slate-400">可在首页包厢满时引导客人加入排队</p>
      </div>
    );
  }

  const activeList = queueData.list.filter(
    (i) => i.status === 'calling' || i.status === 'waiting',
  );
  const historyList = queueData.list.filter(
    (i) => i.status !== 'calling' && i.status !== 'waiting',
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
            <Volume2 className="w-3.5 h-3.5" />
            叫号中 <b>{queueData.callingCount}</b> 组
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            <Clock className="w-3.5 h-3.5" />
            等待中 <b>{queueData.waitingCount}</b> 组
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-100">
            今日累计 <b>{queueData.totalToday}</b> 组
          </span>
        </div>
        <button
          onClick={handleAutoCall}
          disabled={queueData.waitingCount === 0}
          className="btn-primary btn-sm"
        >
          <ChevronRight className="w-4 h-4" />
          自动叫下一位
        </button>
      </div>

      {activeList.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-primary-50/50 to-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary-600" />
            <h3 className="font-semibold text-slate-800">当前队列 ({activeList.length})</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {activeList.map((item) => {
              const st = STATUS_LABEL[item.status];
              const remainMin = item.calledExpireAt
                ? dayjs(item.calledExpireAt).diff(dayjs(), 'minute')
                : null;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'px-5 py-4 flex items-center gap-4 transition-colors',
                    item.status === 'calling' && 'bg-amber-50/40',
                  )}
                >
                  <div
                    className={cn(
                      'w-14 h-14 shrink-0 rounded-xl flex flex-col items-center justify-center',
                      item.status === 'calling'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    <span className="text-[10px] opacity-80 leading-none">#</span>
                    <span className="text-xl font-bold leading-none mt-0.5">
                      {item.queueNumber}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <UserCircle2 className="w-4 h-4 text-slate-400" />
                        {item.customerName}
                      </span>
                      <span className={cn('badge text-[11px]', st.cls)}>{st.label}</span>
                      {item.assignedRoomName && (
                        <span className="badge bg-primary-100 text-primary-700 text-[11px]">
                          包厢 {item.assignedRoomName}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {item.customerPhone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {item.peopleCount} 人
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dayjs(item.createdAt).format('HH:mm')} 取号
                      </span>
                      {remainMin !== null && remainMin > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          叫号剩余 {remainMin} 分钟
                        </span>
                      )}
                      {remainMin !== null && remainMin <= 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                          <AlertCircle className="w-3 h-3" />
                          叫号已超时
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'waiting' && (
                      <button
                        onClick={() => handleCall(item)}
                        disabled={pendingAction === item.id}
                        className="btn-primary btn-sm"
                      >
                        {pendingAction === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                        叫号
                      </button>
                    )}
                    {item.status === 'calling' && (
                      <button
                        onClick={() => handleSkip(item)}
                        disabled={pendingAction === item.id}
                        className="btn-outline btn-sm border-amber-400 text-amber-700 hover:bg-amber-50"
                      >
                        {pendingAction === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <SkipForward className="w-3.5 h-3.5" />
                        )}
                        跳过并叫下一位
                      </button>
                    )}
                    <button
                      onClick={() => handleCancel(item)}
                      disabled={pendingAction === item.id}
                      className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      {pendingAction === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      移除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {historyList.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-700 text-sm">历史记录 ({historyList.length})</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {historyList.map((item) => {
              const st = STATUS_LABEL[item.status];
              return (
                <div
                  key={item.id}
                  className="px-5 py-3 flex items-center gap-3 text-sm opacity-80"
                >
                  <span className="w-8 text-center font-mono text-slate-400">
                    #{item.queueNumber}
                  </span>
                  <span className="font-medium text-slate-700">{item.customerName}</span>
                  <span className="text-slate-500">{item.peopleCount}人</span>
                  <span className="text-slate-400 text-xs">
                    {formatDateTime(item.createdAt)}
                  </span>
                  <div className="ml-auto">
                    <span className={cn('badge text-[10px]', st.cls)}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
