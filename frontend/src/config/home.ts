export interface RecommendationItem {
  title: string;
  tag: string;
  duration: string;
  intensity: string;
  visualClass: string;
}

export interface BottomTabItem {
  label: string;
  icon: 'home' | 'train' | 'record' | 'nutrition' | 'me';
  routeName: 'Home' | 'PlanGenerator' | 'WorkoutLog' | 'Nutrition' | 'Profile';
}

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

export const primaryTabs: BottomTabItem[] = [
  { label: '首页', icon: 'home', routeName: 'Home' },
  { label: '训练计划', icon: 'train', routeName: 'PlanGenerator' },
  { label: '记录', icon: 'record', routeName: 'WorkoutLog' },
  { label: '饮食计划', icon: 'nutrition', routeName: 'Nutrition' },
  { label: '个人资料', icon: 'me', routeName: 'Profile' }
];
