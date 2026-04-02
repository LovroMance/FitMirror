import { describe, expect, it } from 'vitest';
import { buildWorkoutDayDetailViews } from './workout-record-details';
import type { PlanEntity, WorkoutRecordEntity } from '@/types/local-db';

describe('buildWorkoutDayDetailViews', () => {
  it('maps plan-backed, manual, and missing-plan records into readable detail items', () => {
    const records: WorkoutRecordEntity[] = [
      {
        id: 1,
        userId: 7,
        clientRecordId: 'rec-1',
        date: '2026-04-02',
        duration: 18,
        completed: true,
        planId: 2,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:10:00.000Z'
      },
      {
        id: 2,
        userId: 7,
        clientRecordId: 'rec-2',
        date: '2026-04-02',
        duration: 20,
        completed: true,
        createdAt: '2026-04-02T11:00:00.000Z',
        updatedAt: '2026-04-02T11:10:00.000Z'
      },
      {
        id: 3,
        userId: 7,
        clientRecordId: 'rec-3',
        date: '2026-04-02',
        duration: 12,
        completed: false,
        planId: 99,
        createdAt: '2026-04-02T12:00:00.000Z',
        updatedAt: '2026-04-02T12:10:00.000Z'
      }
    ];
    const linkedPlan: PlanEntity = {
      id: 2,
      userId: 7,
      clientPlanId: 'plan-2',
      goalText: '下班后拉伸 15 分钟',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      planJson: {
        title: '晚间拉伸',
        level: 'beginner',
        durationMinutes: 15,
        summary: '舒缓拉伸',
        exercises: []
      }
    };

    const result = buildWorkoutDayDetailViews(records, new Map([[2, linkedPlan]]));

    expect(result[0]).toMatchObject({
      sourceType: 'plan',
      sourceLabel: '计划训练',
      planId: 2,
      planTitle: '晚间拉伸',
      planGoalText: '下班后拉伸 15 分钟',
      canViewPlan: true,
      planMissing: false
    });
    expect(result[1]).toMatchObject({
      sourceType: 'manual',
      sourceLabel: '手动记录',
      planId: null,
      canViewPlan: false,
      planMissing: false
    });
    expect(result[2]).toMatchObject({
      sourceType: 'plan',
      sourceLabel: '计划训练',
      planId: 99,
      planTitle: null,
      canViewPlan: false,
      planMissing: true
    });
  });
});
