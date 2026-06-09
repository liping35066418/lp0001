import { useEffect, useState } from 'react';
import AdminGuard from '@/components/common/AdminGuard';
import PeriodSelector, { type Period } from '@/components/common/PeriodSelector';
import BoardgameRankChart from '@/components/reports/BoardgameRankChart';
import { get } from '@/utils/api';
import { cnDifficulty, difficultyColor, formatMoney } from '@/utils/format';
import { useUIStore } from '@/store/ui';
import dayjs from 'dayjs';
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
      start = customStart ? dayjs(customStart) : dayjs().subtract(30, 'day');
      end = customEnd ? dayjs(customEnd) : dayjs();
      break;
  }
  return { startStr: start.format('YYYY-MM-DD'), endStr: end.format('YYYY-MM-DD') };
}

function BoardgamesContent() {
  const { pushToast } = useUIStore();
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState(
    dayjs().subtract(30, 'day').format('YYYY-MM-DD')
  );
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));

  const [rankData, setRankData] = useState<Reports.BoardgameRentalRank[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: number; name: string; category: string; difficulty: any }>
  >([]);

  const { startStr, endStr } = getDateRange(period, customStart, customEnd);

  const loadData = async () => {
    try {
      const rank = await get<Reports.BoardgameRentalRank[]>(
        `/reports/boardgame-rank?start=${startStr}&end=${endStr}&limit=10`
      );
      setRankData(rank);

      const mockCats = rank.map((r, i) => ({
        id: r.boardgameId,
        name: r.name,
        category: ['策略', '聚会', '卡牌', '推理', '欢乐'][i % 5],
        difficulty: (['easy', 'medium', 'hard', 'expert'] as const)[i % 4],
      }));
      setCategories(mockCats);
    } catch (e) {
      pushToast('数据加载失败', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, [period, customStart, customEnd]);

  const totalRentals = rankData.reduce((s, d) => s + d.rentalCount, 0);
  const totalRevenue = rankData.reduce((s, d) => s + d.revenue, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">桌游租借排行</h1>
          <p className="text-sm text-slate-500 mt-1">桌游租借频次和收入排行</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-slate-500">TOP10总租借次数</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{totalRentals} 次</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">TOP10带来收入</p>
          <p className="text-2xl font-bold text-primary-600 mt-2">{formatMoney(totalRevenue)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500">平均每次收入</p>
          <p className="text-2xl font-bold text-accent-600 mt-2">
            {formatMoney(totalRentals > 0 ? totalRevenue / totalRentals : 0)}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">TOP10 桌游租借排行</h3>
        <BoardgameRankChart data={rankData} categories={categories} />
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">详细排行</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-medium text-slate-600 w-16">排行</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">名称</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">分类</th>
                <th className="text-left py-3 px-4 font-medium text-slate-600">难度</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">租借次数</th>
                <th className="text-right py-3 px-4 font-medium text-slate-600">带来收入</th>
              </tr>
            </thead>
            <tbody>
              {rankData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                rankData.map((item, idx) => {
                  const cat = categories.find((c) => c.name === item.name);
                  return (
                    <tr key={item.boardgameId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${
                            idx === 0
                              ? 'bg-accent-500 text-white'
                              : idx === 1
                              ? 'bg-slate-400 text-white'
                              : idx === 2
                              ? 'bg-orange-400 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                      <td className="py-3 px-4 text-slate-600">{cat?.category || '-'}</td>
                      <td className="py-3 px-4">
                        {cat?.difficulty ? (
                          <span className={`badge ${difficultyColor(cat.difficulty)}`}>
                            {cnDifficulty(cat.difficulty)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700">{item.rentalCount} 次</td>
                      <td className="py-3 px-4 text-right font-semibold text-primary-700">
                        {formatMoney(item.revenue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ReportBoardgames() {
  return (
    <AdminGuard>
      <BoardgamesContent />
    </AdminGuard>
  );
}
