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
  routeName: 'Home' | 'PlanGenerator' | 'WorkoutLog' | 'Exercises';
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

export const homeTabs: BottomTabItem[] = [
  { label: 'HOME', icon: 'home', routeName: 'Home' },
  { label: 'TRAIN', icon: 'train', routeName: 'PlanGenerator' },
  { label: 'LOG', icon: 'log', routeName: 'WorkoutLog' },
  { label: 'LIB', icon: 'me', routeName: 'Exercises' }
];
