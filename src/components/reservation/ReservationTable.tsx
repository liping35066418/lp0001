import { useState } from 'react';
import { Eye, Edit, XCircle, PlayCircle, CheckSquare, Square } from 'lucide-react';
import type { Reservation, PagedResult } from '../../../shared/api-types';
import { formatDateTime, formatMoney, cnSpec } from '@/utils/format';
import Empty from '@/components/Empty';

interface Props {
  data: PagedResult<Reservation.Reservation>;
  roomsMap: Record<number, { name: string; spec: string }>;
  onPageChange: (page: number, pageSize: number) => void;
  onView: (r: Reservation.Reservation) => void;
  onEdit: (r: Reservation.Reservation) => void;
  onCancel: (r: Reservation.Reservation) => void;
  onCheckIn: (r: Reservation.Reservation) => void;
}

const STATUS_STYLES: Record<Reservation.Status, string> = {
  pending: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  cancelled: 'bg-slate-100 text-slate-600',
  no_show: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<Reservation.Status, string> = {
  pending: '待确认',
  checked_in: '已到店',
  cancelled: '已取消',
  no_show: '爽约',
};

export default function ReservationTable({
  data,
  roomsMap,
  onPageChange,
  onView,
  onEdit,
  onCancel,
  onCheckIn,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showId, setShowId] = useState(false);

  const toggleAll = () => {
    if (selectedIds.size === data.list.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.list.map((r) => r.id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const pageOptions = [10, 20, 50];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="w-4 h-4 rounded"
              checked={showId}
              onChange={(e) => setShowId(e.target.checked)}
            />
            显示预约编号
          </label>
          {selectedIds.size > 0 && (
            <span className="text-sm text-slate-500">
              已选 {selectedIds.size} 项
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <button
                  onClick={toggleAll}
                  className="text-slate-400 hover:text-primary-600"
                >
                  {selectedIds.size === data.list.length && data.list.length > 0 ? (
                    <CheckSquare size={16} className="text-primary-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              {showId && <th className="px-4 py-3 text-left font-medium">预约编号</th>}
              <th className="px-4 py-3 text-left font-medium">预约时间</th>
              <th className="px-4 py-3 text-left font-medium">包厢</th>
              <th className="px-4 py-3 text-left font-medium">顾客</th>
              <th className="px-4 py-3 text-left font-medium">电话</th>
              <th className="px-4 py-3 text-right font-medium">人数</th>
              <th className="px-4 py-3 text-right font-medium">订金</th>
              <th className="px-4 py-3 text-left font-medium">创建人</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.list.length === 0 ? (
              <tr>
                <td
                  colSpan={showId ? 11 : 10}
                  className="px-4 py-12"
                >
                  <Empty text="暂无预约数据" />
                </td>
              </tr>
            ) : (
              data.list.map((r) => {
                const room = roomsMap[r.roomId];
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleOne(r.id)}
                        className="text-slate-400 hover:text-primary-600"
                      >
                        {selectedIds.has(r.id) ? (
                          <CheckSquare size={16} className="text-primary-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    {showId && (
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        #{String(r.id).padStart(6, '0')}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="text-slate-800 font-medium">
                        {formatDateTime(r.startAt)}
                      </div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        至 {formatDateTime(r.endAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {room?.name || r.roomName || `#${r.roomId}`}
                      </div>
                      {room?.spec && (
                        <span
                          className={`badge mt-1 ${cnSpec(room.spec as never)}`}
                        >
                          {cnSpec(room.spec as never)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.customerName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.customerPhone}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {r.peopleCount}人
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatMoney(r.depositAmount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      #{r.createdBy}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          className="btn-sm btn-ghost"
                          onClick={() => onView(r)}
                          title="查看"
                        >
                          <Eye size={14} />
                        </button>
                        {r.status === 'pending' && (
                          <>
                            <button
                              className="btn-sm btn-ghost text-primary-600 hover:bg-primary-50"
                              onClick={() => onEdit(r)}
                              title="修改"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              className="btn-sm btn-ghost text-red-600 hover:bg-red-50"
                              onClick={() => onCancel(r)}
                              title="取消"
                            >
                              <XCircle size={14} />
                            </button>
                            <button
                              className="btn-sm btn-ghost text-green-600 hover:bg-green-50"
                              onClick={() => onCheckIn(r)}
                              title="开台"
                            >
                              <PlayCircle size={14} />
                            </button>
                          </>
                        )}
                        {r.status === 'checked_in' && (
                          <button
                            className="btn-sm btn-primary"
                            onClick={() => onCheckIn(r)}
                          >
                            查看场次
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          共 {data.total} 条记录
        </span>
        <div className="flex items-center gap-2">
          <select
            className="input !w-auto !py-1.5 text-sm"
            value={data.pageSize}
            onChange={(e) => onPageChange(1, Number(e.target.value))}
          >
            {pageOptions.map((n) => (
              <option key={n} value={n}>
                {n}条/页
              </option>
            ))}
          </select>
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={onPageChange}
          />
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number, ps: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages: (number | string)[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        className="btn-sm btn-outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1, pageSize)}
      >
        上一页
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i} className="px-2 text-slate-400">
            {p}
          </span>
        ) : (
          <button
            key={p}
            className={`btn-sm ${
              p === page
                ? 'btn-primary'
                : 'btn-ghost'
            }`}
            onClick={() => onChange(p, pageSize)}
          >
            {p}
          </button>
        )
      )}
      <button
        className="btn-sm btn-outline"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1, pageSize)}
      >
        下一页
      </button>
    </div>
  );
}
