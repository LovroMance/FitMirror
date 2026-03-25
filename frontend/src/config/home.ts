export interface RecommendationItem {
  title: string;
  tag: string;
  duration: string;
  intensity: string;
  visualClass: string;
}

export interface BottomTabItem {
  label: string;
  icon: 'home' | 'train' | 'log' | 'me';
  active: boolean;
}

export const homeHeatmap = [
  [0, 1, 0, 2, 1, 0],
  [1, 2, 1, 3, 2, 1],
  [0, 1, 2, 2, 1, 0],
  [1, 3, 2, 4, 3, 1],
  [0, 2, 1, 3, 2, 0],
  [1, 2, 3, 2, 1, 0],
  [0, 1, 0, 2, 1, 0]
];

export const homeRecommendations: RecommendationItem[] = [
  {
    title: '平板支撑',
    tag: '核心力量',
    duration: '12 分钟',
    intensity: '中等强度',
    visualClass: 'recommend-card__visual--core'
  },
  {
    title: '深蹲',
    tag: '腿部力量',
    duration: '10 分钟',
    intensity: '自重训练',
    visualClass: 'recommend-card__visual--leg'
  }
];

export const homeTabs: BottomTabItem[] = [
  { label: 'HOME', icon: 'home', active: true },
  { label: 'TRAIN', icon: 'train', active: false },
  { label: 'LOG', icon: 'log', active: false },
  { label: 'ME', icon: 'me', active: false }
];
