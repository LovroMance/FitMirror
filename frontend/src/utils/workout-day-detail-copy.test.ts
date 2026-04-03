import { describe, expect, it } from 'vitest';
import { getWorkoutDayDetailHint, getWorkoutDayDetailPlanLabel } from './workout-day-detail-copy';
import type { WorkoutDayDetailView } from '@/types/workout';

const createDetail = (overrides: Partial<WorkoutDayDetailView>): WorkoutDayDetailView => ({
  id: 1,
  clientRecordId: 'rec-1',
  date: '2026-04-02',
  duration: 18,
  completed: true,
  isJustCompleted: false,
  sourceType: 'manual',
  sourceLabel: '手动记录',
  planId: null,
  planTitle: null,
  planGoalText: null,
  canViewPlan: false,
  planMissing: false,
  ...overrides
});

describe('workout day detail copy', () => {
  it('returns readable copy for a plan-backed record', () => {
    const detail = createDetail({
      sourceType: 'plan',
      sourceLabel: '计划训练',
      planId: 8,
      planTitle: '晚间拉伸',
      planGoalText: '下班后放松 15 分钟',
      canViewPlan: true
    });

    expect(getWorkoutDayDetailPlanLabel(detail)).toBe('晚间拉伸');
    expect(getWorkoutDayDetailHint(detail)).toBe('下班后放松 15 分钟');
  });

  it('returns manual-record guidance when no plan is linked', () => {
    const detail = createDetail({});

    expect(getWorkoutDayDetailPlanLabel(detail)).toBeNull();
    expect(getWorkoutDayDetailHint(detail)).toBe('这条记录来自手动补录，不会关联历史计划。');
  });

  it('returns missing-plan guidance when the linked plan is gone', () => {
    const detail = createDetail({
      sourceType: 'plan',
      sourceLabel: '计划训练',
      planId: 99,
      planMissing: true
    });

    expect(getWorkoutDayDetailPlanLabel(detail)).toBeNull();
    expect(getWorkoutDayDetailHint(detail)).toBe('原训练计划已删除，无法回看详情。');
  });
});
