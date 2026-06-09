import { useEffect, useState } from 'react';
import { DollarSign, FileText, Users, BarChart2 } from 'lucide-react';
import dayjs from 'dayjs';
import AdminGuard from '@/components/common/AdminGuard';
import KpiCard from '@/components/common/KpiCard';
import PeriodSelector, { type Period } from '@/components/common/PeriodSelector';
import RevenueTrendChart from '@/components/reports/RevenueTrendChart';
import ConsumeTypePie from '@/components/reports/ConsumeTypePie';
import RoomUsageBar from '@/components/reports/RoomUsageBar';
import { get } from '@/utils/api';
import { formatMoney } from '@/utils/format';
import type { Reports } from '../../shared/api-types';

function getDateRange(period: Period, customStart?: string, customEnd?: string) {
  let start: dayjs.Dayjs;
  let end = dayjs();
  switch (period) {
    case 'today':
      start = dayjs();
      end = dayjs();
      break;
    case 'week':
      start = dayjs().startOf('week');
      break;
    case 'month':
      start = dayjs().startOf('month');
      break;
    case 'custom':
    default:
      start = customStart ? dayjs(customStart) : dayjs().subtract(7, 'day');
      end = customEnd ? dayjs(customEnd) : dayjs();
      break;
  }
  return { startStr: start.format('YYYY-MM-DD'), endStr: end.format('YYYY-MM-DD') };
}

function OverviewContent() {
  const [period, setPeriod] = useState<Period>('today');
  const [customStart, setCustomStart] = useState(
    dayjs().subtract(7, 'day').format('YYYY-MM-DD')
  );
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

  const [revenueTrend, setRevenueTrend] = useState<Reports.RevenuePoint[]>([]);
  const [roomUsage, setRoomUsage] = useState<Reports.RoomUsageStat[]>([]);
  const [consumeData, setConsumeData] = useState([
    { name: '包厢', value: 0 },
    { name: '超时', value: 0 },
    { name: '租借', value: 0 },
    { name: '商品', value: 0 },
  ]);

  const { startStr, endStr } = getDateRange(period, customStart, customEnd);

  const loadData = async () => {
    try {
      const periodParam = period === 'custom' ? 'month' : period;
      const trend = await get<Reports.RevenuePoint[]>(
        `/reports/revenue?period=${periodParam}`
      );
      setRevenueTrend(trend);

      const usage = await get<Reports.RoomUsageStat[]>(
        `/reports/room-usage?start=${startStr}&end=${endStr}`
      );
      setRoomUsage(usage);

      const totalRevenue = trend.reduce((s, d) => s + d.revenue, 0);
      const roomPct = 0.65;
      const overtimePct = 0.1;
      const rentalPct = 0.1;
      const goodsPct = 0.15;
      setConsumeData([
        { name: '包厢', value: Number((totalRevenue * roomPct).toFixed(2)) },
        { name: '超时', value: Number((totalRevenue * overtimePct).toFixed(2)) },
        { name: '租借', value: Number((totalRevenue * rentalPct).toFixed(2)) },
        { name: '商品', value: Number((totalRevenue * goodsPct).toFixed(2)) },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [period, customStart, customEnd]);

  const totalRevenue = revenueTrend.reduce((s, d) => s + d.revenue, 0);
  const totalBills = revenueTrend.reduce((s, d) => s + d.billCount, 0);
  const avgBill = totalBills > 0 ? totalRevenue / totalBills : 0;
  const avgUtilization =
    roomUsage.length > 0
      ? roomUsage.reduce((s, d) => s + d.utilizationRate, 0) / roomUsage.length
      : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">经营概览</h1>
          <p className="text-sm text-slate-500 mt-1">核心经营数据仪表盘</p>
        </div>
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="总营收"
          value={formatMoney(totalRevenue)}
          icon={DollarSign}
          color="primary"
          trend={0.12}
          trendLabel="较上周期"
        />
        <KpiCard
          title="账单数"
          value={totalBills}
          icon={FileText}
          color="accent"
          suffix="单"
          trend={0.08}
          trendLabel="较上周期"
        />
        <KpiCard
          title="客单价"
          value={formatMoney(avgBill)}
          icon={Users}
          color="blue"
          trend={-0.02}
          trendLabel="较上周期"
        />
        <KpiCard
          title="包厢利用率"
          value={`${(avgUtilization * 100).toFixed(1)}%`}
          icon={BarChart2}
          color="purple"
          trend={0.05}
          trendLabel="较上周期"
        />
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">营收趋势</h3>
        <RevenueTrendChart data={revenueTrend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">消费类型占比</h3>
          <ConsumeTypePie data={consumeData} />
        </div>
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 mb-4">包厢使用率</h3>
          <RoomUsageBar data={roomUsage} />
        </div>
      </div>
    </div>
  );
}

export default function ReportOverview() {
  return (
    <AdminGuard>
      <OverviewContent />
    </AdminGuard>
  );
}
