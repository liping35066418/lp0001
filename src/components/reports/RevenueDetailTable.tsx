import { formatMoney } from '@/utils/format';
import type { Reports } from '../../../shared/api-types';

interface RevenueDetailTableProps {
  data: Reports.RevenuePoint[];
  dailyBreakdown?: Array<{
    date: string;
    billCount: number;
    roomFee: number;
    overtimeFee: number;
    rentalFee: number;
    goodsFee: number;
    total: number;
  }>;
}

export default function RevenueDetailTable({ data, dailyBreakdown }: RevenueDetailTableProps) {
  const rows = dailyBreakdown || data.map((d) => ({
    date: d.date,
    billCount: d.billCount,
    roomFee: 0,
    overtimeFee: 0,
    rentalFee: 0,
    goodsFee: 0,
    total: d.revenue,
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      billCount: acc.billCount + r.billCount,
      roomFee: acc.roomFee + r.roomFee,
      overtimeFee: acc.overtimeFee + r.overtimeFee,
      rentalFee: acc.rentalFee + r.rentalFee,
      goodsFee: acc.goodsFee + r.goodsFee,
      total: acc.total + r.total,
    }),
    { billCount: 0, roomFee: 0, overtimeFee: 0, rentalFee: 0, goodsFee: 0, total: 0 }
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-medium text-slate-600">日期</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">账单数</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">包厢费</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">超时费</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">租借费</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">商品费</th>
            <th className="text-right py-3 px-4 font-medium text-slate-600">合计</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-slate-400">
                暂无数据
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-3 px-4 text-slate-800">{r.date}</td>
                <td className="py-3 px-4 text-right text-slate-700">{r.billCount}</td>
                <td className="py-3 px-4 text-right text-slate-700">{formatMoney(r.roomFee)}</td>
                <td className="py-3 px-4 text-right text-slate-700">{formatMoney(r.overtimeFee)}</td>
                <td className="py-3 px-4 text-right text-slate-700">{formatMoney(r.rentalFee)}</td>
                <td className="py-3 px-4 text-right text-slate-700">{formatMoney(r.goodsFee)}</td>
                <td className="py-3 px-4 text-right font-semibold text-slate-800">
                  {formatMoney(r.total)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-slate-50 font-medium">
              <td className="py-3 px-4 text-slate-800">合计</td>
              <td className="py-3 px-4 text-right text-slate-800">{totals.billCount}</td>
              <td className="py-3 px-4 text-right text-slate-800">{formatMoney(totals.roomFee)}</td>
              <td className="py-3 px-4 text-right text-slate-800">{formatMoney(totals.overtimeFee)}</td>
              <td className="py-3 px-4 text-right text-slate-800">{formatMoney(totals.rentalFee)}</td>
              <td className="py-3 px-4 text-right text-slate-800">{formatMoney(totals.goodsFee)}</td>
              <td className="py-3 px-4 text-right text-primary-700">{formatMoney(totals.total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
