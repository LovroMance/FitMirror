import { describe, expect, it } from 'vitest';
import type { TrainingPlan } from '@/types/plan';
import {
  buildPlanExerciseChangeMarkers,
  buildPlanEditChangeSummary,
  buildPlanEditChangeSummaryHighlights,
  buildPlanEditChangeSummaryMessage
} from './plan-edit-change-summary';

const basePlan: TrainingPlan = {
  title: '10分钟核心激活训练',
  level: 'beginner',
  durationMinutes: 10,
  summary: '适合快速完成的核心训练。',
  exercises: [
    {
      name: '平板支撑',
      durationSeconds: 30,
      restSeconds: 20,
      instruction: '保持身体成一直线。'
    },
    {
      name: '登山跑',
      durationSeconds: 40,
      restSeconds: 20,
      instruction: '保持核心收紧。'
    }
  ]
};

describe('plan-edit-change-summary', () => {
  it('summarizes title, duration, replacement and append changes', () => {
    const summary = buildPlanEditChangeSummary(basePlan, {
      ...basePlan,
      title: '12分钟核心训练',
      durationMinutes: 12,
      exercises: [
        {
          name: '死虫式',
          reps: '左右各 12 次',
          restSeconds: 20,
          instruction: '缓慢伸展四肢并保持核心稳定。'
        },
        basePlan.exercises[1],
        {
          name: '卷腹',
          reps: '15-20 次',
          restSeconds: 20,
          instruction: '仰卧屈膝脚掌踩地。'
        }
      ]
    });

    expect(summary).toMatchObject({
      titleChanged: true,
      durationChanged: true,
      reordered: false,
      addedExerciseNames: ['卷腹'],
      removedExerciseNames: [],
      replacedExercises: [
        {
          previousName: '平板支撑',
          nextName: '死虫式'
        }
      ],
      nextDurationMinutes: 12,
      hasChanges: true
    });
    expect(buildPlanEditChangeSummaryHighlights(summary)).toEqual([
      '已更新计划标题',
      '已调整总时长为 12 分钟',
      '已替换动作：“平板支撑” -> “死虫式”',
      '已添加动作：“卷腹”'
    ]);
    expect(buildPlanEditChangeSummaryMessage(summary)).toBe(
      '训练计划已更新：已更新计划标题；已调整总时长为 12 分钟；已替换动作：“平板支撑” -> “死虫式”；已添加动作：“卷腹”'
    );
  });

  it('summarizes reordered exercises without misreporting replacements', () => {
    const summary = buildPlanEditChangeSummary(basePlan, {
      ...basePlan,
      exercises: [basePlan.exercises[1], basePlan.exercises[0]]
    });

    expect(summary).toMatchObject({
      titleChanged: false,
      durationChanged: false,
      reordered: true,
      addedExerciseNames: [],
      removedExerciseNames: [],
      replacedExercises: [],
      hasChanges: true
    });
    expect(buildPlanEditChangeSummaryHighlights(summary)).toEqual(['已调整动作顺序']);
    expect(buildPlanEditChangeSummaryMessage(summary)).toBe('训练计划已更新：已调整动作顺序');
  });

  it('falls back to a generic message when no diff is found', () => {
    const summary = buildPlanEditChangeSummary(basePlan, basePlan);

    expect(summary.hasChanges).toBe(false);
    expect(buildPlanEditChangeSummaryHighlights(summary)).toEqual([]);
    expect(buildPlanEditChangeSummaryMessage(summary)).toBe('训练计划已更新');
  });

  it('builds per-exercise markers for replaced and added exercises', () => {
    const nextPlan: TrainingPlan = {
      ...basePlan,
      exercises: [
        {
          name: '死虫式',
          reps: '左右各 12 次',
          restSeconds: 20,
          instruction: '缓慢伸展四肢并保持核心稳定。'
        },
        basePlan.exercises[1],
        {
          name: '卷腹',
          reps: '15-20 次',
          restSeconds: 20,
          instruction: '仰卧屈膝脚掌踩地。'
        }
      ]
    };
    const summary = buildPlanEditChangeSummary(basePlan, nextPlan);

    expect(buildPlanExerciseChangeMarkers(summary, nextPlan)).toEqual([
      {
        kind: 'replaced',
        label: '已替换',
        previousName: '平板支撑'
      },
      null,
      {
        kind: 'added',
        label: '新增'
      }
    ]);
  });
});
