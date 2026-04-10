import type { ReportData } from '../types';

export const MOCK_REPORT: ReportData = {
  title: '2026年4月热力运行分析报告',
  period: '2026-04-01 ~ 2026-04-30',
  summary: [
    '本月供热运行总体稳定，累计供热面积 2,340 万㎡',
    '门头沟站热耗同比上升 23%，建议重点排查管网老化及保温层情况',
    '华能热水炉出口温度一度突破安全阈值 135℃，持续 47 分钟后回落',
    '西八里庄片区存在 4 次回水温度异常波动，需关注用户侧换热站运行',
    '独网电耗排名第 3 位，较上月下降 2 位，单位供热量电耗 8.2 kWh/GJ',
  ],
  metrics: [
    { label: '供水均温', value: '85.6', unit: '℃', trend: 'stable' },
    { label: '回水均温', value: '52.3', unit: '℃', trend: 'down' },
    { label: '月度总能耗', value: '1,284', unit: 'GJ', trend: 'up' },
    { label: '异常事件数', value: '7', unit: '次', trend: 'up' },
    { label: '管网损耗率', value: '4.2', unit: '%', trend: 'stable' },
    { label: '供热面积', value: '2,340', unit: '万㎡', trend: 'stable' },
  ],
  source: '基于知识库中 3 份文档自动生成',
};

export const REPORT_STEPS = [
  { name: '数据汇总', desc: '从知识库提取相关运行数据', duration: 1500 },
  { name: '趋势分析', desc: '计算环比/同比变化趋势', duration: 2000 },
  { name: '报告生成', desc: '生成结构化分析报告', duration: 1800 },
];
