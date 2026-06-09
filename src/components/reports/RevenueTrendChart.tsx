import ReactECharts from 'echarts-for-react';

interface RevenueTrendChartProps {
  data: Array<{ date: string; revenue: number; billCount: number }>;
  currentData?: Array<{ date: string; revenue: number; billCount: number }>;
  previousData?: Array<{ date: string; revenue: number; billCount: number }>;
  compareMode?: boolean;
}

export default function RevenueTrendChart({
  data,
  currentData,
  previousData,
  compareMode = false,
}: RevenueTrendChartProps) {
  const option = compareMode
    ? {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: ['本周期营收', '上周期营收', '本周期单量', '上周期单量'],
          bottom: 0,
        },
        grid: { left: 60, right: 60, top: 40, bottom: 60 },
        xAxis: {
          type: 'category',
          data: currentData?.map((d) => d.date),
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: { color: '#64748b' },
        },
        yAxis: [
          {
            type: 'value',
            name: '金额(元)',
            axisLine: { show: false },
            splitLine: { lineStyle: { color: '#f1f5f9' } },
            axisLabel: { color: '#64748b' },
          },
          {
            type: 'value',
            name: '单量',
            axisLine: { show: false },
            splitLine: { show: false },
            axisLabel: { color: '#64748b' },
          },
        ],
        series: [
          {
            name: '本周期营收',
            type: 'line',
            smooth: true,
            yAxisIndex: 0,
            data: currentData?.map((d) => d.revenue),
            itemStyle: { color: '#328C57' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(50,140,87,0.3)' },
                  { offset: 1, color: 'rgba(50,140,87,0.02)' },
                ],
              },
            },
          },
          {
            name: '上周期营收',
            type: 'line',
            smooth: true,
            yAxisIndex: 0,
            data: previousData?.map((d) => d.revenue),
            itemStyle: { color: '#94a3b8' },
            lineStyle: { type: 'dashed' },
          },
          {
            name: '本周期单量',
            type: 'bar',
            yAxisIndex: 1,
            data: currentData?.map((d) => d.billCount),
            itemStyle: { color: '#D4AF37', borderRadius: [4, 4, 0, 0] },
            barWidth: 16,
          },
          {
            name: '上周期单量',
            type: 'bar',
            yAxisIndex: 1,
            data: previousData?.map((d) => d.billCount),
            itemStyle: { color: '#cbd5e1', borderRadius: [4, 4, 0, 0] },
            barWidth: 16,
          },
        ],
      }
    : {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: ['营收金额', '账单数'],
          bottom: 0,
        },
        grid: { left: 60, right: 60, top: 40, bottom: 60 },
        xAxis: {
          type: 'category',
          data: data.map((d) => d.date),
          axisLine: { lineStyle: { color: '#e2e8f0' } },
          axisLabel: { color: '#64748b' },
        },
        yAxis: [
          {
            type: 'value',
            name: '金额(元)',
            axisLine: { show: false },
            splitLine: { lineStyle: { color: '#f1f5f9' } },
            axisLabel: { color: '#64748b' },
          },
          {
            type: 'value',
            name: '单量',
            axisLine: { show: false },
            splitLine: { show: false },
            axisLabel: { color: '#64748b' },
          },
        ],
        series: [
          {
            name: '营收金额',
            type: 'line',
            smooth: true,
            yAxisIndex: 0,
            data: data.map((d) => d.revenue),
            itemStyle: { color: '#328C57' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(50,140,87,0.3)' },
                  { offset: 1, color: 'rgba(50,140,87,0.02)' },
                ],
              },
            },
          },
          {
            name: '账单数',
            type: 'bar',
            yAxisIndex: 1,
            data: data.map((d) => d.billCount),
            itemStyle: { color: '#D4AF37', borderRadius: [4, 4, 0, 0] },
            barWidth: 18,
          },
        ],
      };

  return <ReactECharts option={option} style={{ height: 340 }} notMerge />;
}
