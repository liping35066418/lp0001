import ReactECharts from 'echarts-for-react';

interface ConsumeTypePieProps {
  data: Array<{ name: string; value: number }>;
}

const typeColors: Record<string, string> = {
  包厢: '#328C57',
  超时: '#D4AF37',
  租借: '#6366f1',
  商品: '#f97316',
};

export default function ConsumeTypePie({ data }: ConsumeTypePieProps) {
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ￥{c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemGap: 12,
    },
    color: data.map((d) => typeColors[d.name] || '#94a3b8'),
    series: [
      {
        name: '消费类型',
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        labelLine: { show: false },
        data,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 320 }} notMerge />;
}
