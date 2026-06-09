import ReactECharts from 'echarts-for-react';

interface RoomUsageBarProps {
  data: Array<{ roomName: string; utilizationRate: number; revenue: number }>;
}

export default function RoomUsageBar({ data }: RoomUsageBarProps) {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const p = params[0];
        const rate = (p.value * 100).toFixed(1);
        return `${p.name}<br/>利用率: ${rate}%`;
      },
    },
    grid: { left: 60, right: 40, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.roomName),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisLabel: { color: '#64748b', interval: 0 },
    },
    yAxis: {
      type: 'value',
      max: 1,
      axisLabel: {
        color: '#64748b',
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.utilizationRate),
        barWidth: 32,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (params: { value: number }) => {
            const v = params.value;
            if (v >= 0.8) return '#328C57';
            if (v >= 0.5) return '#D4AF37';
            return '#94a3b8';
          },
        },
        label: {
          show: true,
          position: 'top',
          formatter: (p: { value: number }) => `${(p.value * 100).toFixed(0)}%`,
          color: '#475569',
          fontSize: 12,
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />;
}
