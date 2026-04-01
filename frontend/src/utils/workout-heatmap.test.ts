import { describe, expect, it } from 'vitest';
import {
  buildDailyHeatmapPoints,
  calculateWorkoutSummary,
  calculateWorkoutTrendSummary,
  getDateRangeByPeriod
} from './workout-heatmap';

describe('workout-heatmap utils', () => {
  it('builds ordered daily points and ignores invalid records', () => {
    const result = buildDailyHeatmapPoints(
      [
        { id: 1, userId: 7, date: '2026-03-31', duration: 12, completed: true },
        { id: 2, userId: 7, date: '2026-04-01', duration: 20, completed: true },
        { id: 3, userId: 7, date: '2026-04-01', duration: 15, completed: false },
        { id: 4, userId: 7, date: 'invalid-date', duration: 15, completed: true },
        { id: 5, userId: 7, date: '2026-04-02', duration: 0, completed: true }
      ],
      ['2026-03-31', '2026-04-01', '2026-04-02']
    );

    expect(result).toEqual([
      expect.objectContaining({
        date: '2026-03-31',
        count: 1,
        completedCount: 1,
        totalDuration: 12,
        intensityLevel: 1
      }),
      expect.objectContaining({
        date: '2026-04-01',
        count: 2,
        completedCount: 1,
        totalDuration: 35,
        intensityLevel: 3
      }),
      expect.objectContaining({
        date: '2026-04-02',
        count: 0,
        completedCount: 0,
        totalDuration: 0,
        intensityLevel: 0
      })
    ]);
  });

  it('calculates summary and trend metrics from heatmap points', () => {
    const points = buildDailyHeatmapPoints(
      [
        { id: 1, userId: 7, date: '2026-03-30', duration: 15, completed: true },
        { id: 2, userId: 7, date: '2026-03-31', duration: 30, completed: true },
        { id: 3, userId: 7, date: '2026-04-01', duration: 45, completed: true }
      ],
      ['2026-03-30', '2026-03-31', '2026-04-01']
    );

    expect(calculateWorkoutSummary(points)).toEqual({
      trainingDays: 3,
      totalDuration: 90,
      streakDays: 3
    });
    expect(calculateWorkoutTrendSummary(points)).toEqual({
      trainingDays: 3,
      totalDuration: 90,
      averageDuration: 30,
      busiestDate: '2026-04-01'
    });
  });

  it('returns expected date range sizes for supported periods', () => {
    expect(getDateRangeByPeriod('week').dates).toHaveLength(42);
    expect(getDateRangeByPeriod('month').dates).toHaveLength(30);
  });
});
