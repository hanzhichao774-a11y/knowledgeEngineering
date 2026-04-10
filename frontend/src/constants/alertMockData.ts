import type { AlertItem } from '../types';

export const MOCK_ALERTS: AlertItem[] = [
  {
    id: 'alert-001',
    severity: 'high',
    category: 'threshold',
    title: '华能热水炉出口温度超限',
    description: '华能热水炉出口温度 136.2℃，超过安全阈值 135℃，已持续 47 分钟',
    source: '热力运行简报 2026-04',
    time: '2026-04-01 14:23',
  },
  {
    id: 'alert-002',
    severity: 'high',
    category: 'anomaly',
    title: '门头沟站热耗同比异常上升',
    description: '门头沟站 4月热耗同比上升 23%，偏离均值 2.1 个标准差，建议排查管网运行状态',
    source: '月度能耗统计报表',
    time: '2026-04-02 09:15',
  },
  {
    id: 'alert-003',
    severity: 'medium',
    category: 'anomaly',
    title: '西八里庄片区回水温度波动',
    description: '西八里庄片区回水温度在 45-62℃ 间频繁波动，标准差 5.7℃，超出正常范围',
    source: '热力运行简报 2026-04',
    time: '2026-04-01 22:10',
  },
  {
    id: 'alert-004',
    severity: 'low',
    category: 'missing',
    title: '数据缺失：凌晨温度记录',
    description: '西八里庄片区 4月2日 03:00-05:00 缺少回水温度记录，共缺失 4 个采集点',
    source: '自动采集系统',
    time: '2026-04-02 06:00',
  },
  {
    id: 'alert-005',
    severity: 'medium',
    category: 'threshold',
    title: '独网电耗排名偏高',
    description: '北京市域独网电耗排名第 3，较上月下降 2 位，单位供热量电耗 8.2 kWh/GJ',
    source: '北京市域内独网电耗情况排名表',
    time: '2026-04-02 08:00',
  },
];
