import { useEffect, useState } from 'react';
import { Search, Calendar, Eye, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import Modal from '@/components/common/Modal';
import { get } from '@/utils/api';
import {
  formatMoney,
  formatMinutes,
  formatDateTime,
  cnStatusPay,
} from '@/utils/format';
import { useUIStore } from '@/store/ui';
import type { Bill, PagedResult, Room } from '../../shared/api-types';

const payMethodOptions: { value: '' | Bill.PayMethod; label: string }[] = [
  { value: '', label: '全部方式' },
  { value: 'cash', label: '现金' },
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'member', label: '会员卡' },
  { value: 'mixed', label: '混合' },
];

export default function BillHistory() {
  const { pushToast } = useUIStore();

  const [dateStart, setDateStart] = useState(
    dayjs().subtract(7, 'day').format('YYYY-MM-DD')
  );
  const [dateEnd, setDateEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [roomId, setRoomId] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  const [rooms, setRooms] = useState<Room.Room[]>([]);
  const [bills, setBills] = useState<Bill.Bill[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Bill.Bill | null>(null);

  useEffect(() => {
    get<Room.Room[]>('/rooms')
      .then((list) => setRooms(list.filter((r) => r.status !== 'disabled')))
      .catch(() => {});
  }, []);

  const loadBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (dateStart) params.set('dateStart', dateStart);
      if (dateEnd) params.set('dateEnd', dateEnd);
      if (payMethod) params.set('payMethod', payMethod);
      const result = await get<PagedResult<Bill.Bill>>(
        `/bills?${params.toString()}`
      );
      let list = result.list;
      if (roomId) {
        list = list.filter((b) => String(b.roomId) === roomId);
      }
      if (keyword.trim()) {
        const kw = keyword.trim().toLowerCase();
        list = list.filter(
          (b) =>
            b.billNo.toLowerCase().includes(kw) ||
            (b.customerName || '').toLowerCase().includes(kw)
        );
      }
      setBills(list);
      setTotal(result.total);
    } catch (e) {
      pushToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, [page, dateStart, dateEnd, roomId, payMethod, keyword]);

  const openDetail = async (id: number) => {
    try {
      const d = await get<Bill.Bill>(`/bills/${id}`);
      setDetail(d);
      setDetailOpen(true);
    } catch (e) {
      pushToast('加载详情失败', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
    pushToast('已发送打印任务', 'success');
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const summaryAmount = bills.reduce((s, b) => s + b.totalAmount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">历史账单</h1>
        <p className="text-sm text-slate-500 mt-1">查看历史账单和消费记录</p>
      </div>

      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <label className="label">开始日期</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                className="input pl-9"
                value={dateStart}
                onChange={(e) => {
                  setDateStart(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <label className="label">结束日期</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                className="input pl-9"
                value={dateEnd}
                onChange={(e) => {
                  setDateEnd(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div>
            <label className="label">包厢</label>
            <select
              className="input"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">全部包厢</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">支付方式</label>
            <select
              className="input"
              value={payMethod}
              onChange={(e) => {
                setPayMethod(e.target.value);
                setPage(1);
              }}
            >
              {payMethodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="label">搜索</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="input pl-9"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="账单号 / 顾客姓名"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-slate-500">筛选结果总金额</p>
          <p className="text-2xl font-bold text-primary-600 mt-2">
            {formatMoney(summaryAmount)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">筛选结果总单数</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{bills.length} 单</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">数据库匹配总数</p>
          <p className="text-2xl font-bold text-accent-600 mt-2">{total} 单</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-slate-600">账单号</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">时间</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">包厢</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">顾客</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">时长</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">小计</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">优惠</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">合计</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">支付方式</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    暂无符合条件的账单
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 px-4">
                      <button
                        className="text-primary-600 hover:underline font-mono text-xs"
                        onClick={() => openDetail(b.id)}
                      >
                        {b.billNo}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {formatDateTime(b.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{b.roomName || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {b.customerName || '散客'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {formatMinutes(b.durationMinutes)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {formatMoney(b.subtotal)}
                    </td>
                    <td className="py-3 px-4 text-right text-red-500">
                      {b.discountAmount > 0 ? `-${formatMoney(b.discountAmount)}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-primary-700">
                      {formatMoney(b.totalAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge bg-slate-100 text-slate-600">
                        {cnStatusPay(b.payMethod)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        className="btn-ghost btn-sm text-primary-600"
                        onClick={() => openDetail(b.id)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            第 {page} / {totalPages} 页，共 {total} 条
          </p>
          <div className="flex items-center gap-1">
            <button
              className="btn btn-outline btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={detailOpen}
        title="账单详情"
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        size="lg"
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => {
                setDetailOpen(false);
                setDetail(null);
              }}
            >
              关闭
            </button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              打印小票
            </button>
          </>
        }
      >
        {detail ? (
          <div className="space-y-5 print:space-y-4">
            <div className="text-center border-b border-dashed border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-800">消费账单</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">{detail.billNo}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDateTime(detail.createdAt)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">包厢：</span>
                <span className="text-slate-800 font-medium">{detail.roomName || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">顾客：</span>
                <span className="text-slate-800 font-medium">
                  {detail.customerName || '散客'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">开始：</span>
                <span className="text-slate-700">{formatDateTime(detail.startAt)}</span>
              </div>
              <div>
                <span className="text-slate-500">结束：</span>
                <span className="text-slate-700">{formatDateTime(detail.endAt)}</span>
              </div>
              <div>
                <span className="text-slate-500">时长：</span>
                <span className="text-slate-800">
                  {formatMinutes(detail.durationMinutes)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">支付方式：</span>
                <span className="text-slate-800">{cnStatusPay(detail.payMethod)}</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">消费明细</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 font-medium text-slate-500">项目</th>
                    <th className="text-right py-2 font-medium text-slate-500">数量</th>
                    <th className="text-right py-2 font-medium text-slate-500">单价</th>
                    <th className="text-right py-2 font-medium text-slate-500">小计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-50">
                    <td className="py-2 text-slate-700">包厢费</td>
                    <td className="py-2 text-right text-slate-600">
                      {(detail.durationMinutes / 60).toFixed(1)}小时
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {formatMoney(detail.roomFee / Math.max(1, detail.durationMinutes / 60))}
                    </td>
                    <td className="py-2 text-right text-slate-700">
                      {formatMoney(detail.roomFee)}
                    </td>
                  </tr>
                  {detail.overtimeFee > 0 && (
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">超时费</td>
                      <td className="py-2 text-right text-slate-600">-</td>
                      <td className="py-2 text-right text-slate-600">-</td>
                      <td className="py-2 text-right text-slate-700">
                        {formatMoney(detail.overtimeFee)}
                      </td>
                    </tr>
                  )}
                  {detail.rentalFee > 0 && (
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">租借费</td>
                      <td className="py-2 text-right text-slate-600">-</td>
                      <td className="py-2 text-right text-slate-600">-</td>
                      <td className="py-2 text-right text-slate-700">
                        {formatMoney(detail.rentalFee)}
                      </td>
                    </tr>
                  )}
                  {detail.goodsFee > 0 && (
                    <tr className="border-b border-slate-50">
                      <td className="py-2 text-slate-700">商品费</td>
                      <td className="py-2 text-right text-slate-600">-</td>
                      <td className="py-2 text-right text-slate-600">-</td>
                      <td className="py-2 text-right text-slate-700">
                        {formatMoney(detail.goodsFee)}
                      </td>
                    </tr>
                  )}
                  {detail.items && detail.items.length > 0
                    ? detail.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-slate-50">
                          <td className="py-2 text-slate-700">{it.name}</td>
                          <td className="py-2 text-right text-slate-600">{it.quantity}</td>
                          <td className="py-2 text-right text-slate-600">
                            {formatMoney(it.unitPrice)}
                          </td>
                          <td className="py-2 text-right text-slate-700">
                            {formatMoney(it.subtotal)}
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">小计</span>
                <span className="text-slate-700">{formatMoney(detail.subtotal)}</span>
              </div>
              {detail.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">优惠减免</span>
                  <span className="text-red-500">-{formatMoney(detail.discountAmount)}</span>
                </div>
              )}
              {detail.depositRefund > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">押金退还</span>
                  <span className="text-green-600">-{formatMoney(detail.depositRefund)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-700 font-medium">应收合计</span>
                <span className="text-xl font-bold text-primary-700">
                  {formatMoney(detail.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">实收</span>
                <span className="text-slate-700">{formatMoney(detail.paidAmount)}</span>
              </div>
              {detail.changeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">找零</span>
                  <span className="text-slate-700">{formatMoney(detail.changeAmount)}</span>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-slate-400 pt-2 border-t border-dashed border-slate-200">
              感谢光临，欢迎再来！
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
