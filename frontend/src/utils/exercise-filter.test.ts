import { describe, expect, it } from 'vitest';
import { filterExercises } from './exercise-filter';
import type { ExerciseItem } from '@/types/exercise';

const exercises: ExerciseItem[] = [
  {
    id: 'plank',
    name: '平板支撑',
    bodyPart: 'core',
    level: 'beginner',
    equipment: 'none',
    durationMinutes: 5,
    sets: 3,
    reps: '30 秒',
    description: '基础核心稳定动作',
    instructions: ['保持身体成一直线'],
    tips: ['避免塌腰'],
    tags: ['核心', '居家']
  },
  {
    id: 'squat',
    name: '深蹲',
    bodyPart: 'lower',
    level: 'intermediate',
    equipment: 'dumbbell',
    durationMinutes: 8,
    sets: 4,
    reps: '12 次',
    description: '下肢力量训练',
    instructions: ['臀部后坐'],
    tips: ['膝盖与脚尖同向'],
    tags: ['下肢', '燃脂']
  }
];

describe('filterExercises', () => {
  it('supports stacked filters', () => {
    const result = filterExercises(exercises, {
      keyword: '',
      bodyPart: 'lower',
      level: 'intermediate',
      equipment: 'dumbbell'
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('squat');
  });

  it('matches keyword against text fields and tags', () => {
    expect(
      filterExercises(exercises, {
        keyword: '居家',
        bodyPart: 'all',
        level: 'all',
        equipment: 'all'
      })
    ).toEqual([exercises[0]]);

    expect(
      filterExercises(exercises, {
        keyword: '下肢',
        bodyPart: 'all',
        level: 'all',
        equipment: 'all'
      })
    ).toEqual([exercises[1]]);
  });

  it('matches plan-style aliases against library names', () => {
    expect(
      filterExercises(
        [
          {
            ...exercises[0],
            id: 'high-knees',
            name: '高抬腿'
          }
        ],
        {
          keyword: '原地高抬腿',
          bodyPart: 'all',
          level: 'all',
          equipment: 'all'
        }
      )
    ).toHaveLength(1);
  });
});
