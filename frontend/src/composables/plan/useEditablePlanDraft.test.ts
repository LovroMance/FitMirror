import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingPlan } from '@/types/plan';
import { useEditablePlanDraft } from './useEditablePlanDraft';

const samplePlan: TrainingPlan = {
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

describe('useEditablePlanDraft', () => {
  const notifyWarning = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds and updates an editable training plan draft', () => {
    const editor = useEditablePlanDraft({ notifyWarning });

    editor.startEditingPlan(samplePlan);
    expect(editor.hasUnsavedEditingPlanChanges.value).toBe(false);

    editor.updateEditingPlanTitle('8分钟核心快练');
    editor.updateEditingPlanDuration(8);
    editor.moveEditingPlanExerciseDown(0);
    editor.replaceEditingPlanExercise(0, {
      name: '死虫式',
      reps: '左右各 12 次',
      restSeconds: 20,
      instruction: '缓慢伸展四肢并保持核心稳定。'
    });

    expect(editor.editablePlanDraft.value).toMatchObject({
      title: '8分钟核心快练',
      durationMinutes: 8,
      exercises: [
        { name: '死虫式' },
        { name: '平板支撑' }
      ]
    });
    expect(editor.hasUnsavedEditingPlanChanges.value).toBe(true);
  });

  it('prevents removing the last remaining exercise', () => {
    const editor = useEditablePlanDraft({ notifyWarning });

    editor.startEditingPlan({
      ...samplePlan,
      exercises: [samplePlan.exercises[0]]
    });
    editor.removeEditingPlanExercise(0);

    expect(notifyWarning).toHaveBeenCalledWith('训练计划至少需要保留 1 个动作');
    expect(editor.editablePlanDraft.value?.exercises).toHaveLength(1);
  });

  it('validates and returns a training plan ready to save', () => {
    const editor = useEditablePlanDraft({ notifyWarning });

    editor.startEditingPlan(samplePlan);
    editor.updateEditingPlanTitle('  12分钟核心训练  ');
    editor.updateEditingPlanDuration(12);

    expect(editor.buildValidatedEditingPlan()).toMatchObject({
      title: '12分钟核心训练',
      durationMinutes: 12
    });
  });

  it('marks the current draft as saved after syncing the baseline', () => {
    const editor = useEditablePlanDraft({ notifyWarning });

    editor.startEditingPlan(samplePlan);
    editor.updateEditingPlanTitle('12分钟核心训练');

    expect(editor.hasUnsavedEditingPlanChanges.value).toBe(true);

    editor.syncEditingPlanDraftAsSaved();

    expect(editor.hasUnsavedEditingPlanChanges.value).toBe(false);
  });
});
