import ReactECharts from 'echarts-for-react';
import type { Boardgame, Reports } from '../../../shared/api-types';

interface BoardgameRankChartProps {
  data: Reports.BoardgameRentalRank[];
  categories?: Array<{ id: number; name: string; category: string; difficulty: Boardgame.Difficulty }>;
}

const categoryColors: Record<string, string> = {
  策略: '#328C57',
  聚会: '#D4AF37',
  卡牌: '#6366f1',
  推理: '#f97316',
  欢乐: '#ec4899',
  合作: '#06b6d4',
};

export default function BoardgameRankChart({ data, categories }: BoardgameRankChartProps) {
  const sorted = [...data].reverse();
  const names = sorted.map((d) => d.name);
  const values = sorted.map((d) => d.rentalCount);
  const colors = sorted.map((d) => {
    if (!categories) return '#328C57';
    const bg = categories.find((c) => c.name === d.name);
    if (!bg) return '#94a3b8';
    return categoryColors[bg.category] || '#328C57';
  });

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const p = params[0];
        const item = sorted[p.dataIndex];
        return `${item.name}<br/>租借次数: ${item.rentalCount}次<br/>带来收入: ￥${item.revenue.toFixed(2)}`;
      },
    },
    grid: { left: 120, right: 40, top: 20, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#475569' },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: {
            color: colors[i],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 20,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}次',
          color: '#475569',
          fontSize: 12,
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: Math.max(320, data.length * 42) }} notMerge />;
}
