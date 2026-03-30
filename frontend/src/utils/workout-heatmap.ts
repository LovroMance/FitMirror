import dayjs from 'dayjs';
import type { WorkoutRecordEntity } from '@/types/local-db';
import type { DailyHeatmapPoint, WorkoutSummary } from '@/types/workout';

const getIntensityLevel = (count: number, totalDuration: number): 0 | 1 | 2 | 3 | 4 => {
  if (count <= 0) {
    return 0;
  }

  if (count >= 3 || totalDuration >= 60) {
    return 4;
  }

  if (count === 2 || totalDuration >= 35) {
    return 3;
  }

  if (totalDuration >= 20) {
    return 2;
  }

  return 1;
};

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const sanitizeRecord = (record: WorkoutRecordEntity): WorkoutRecordEntity | null => {
  if (!isValidDate(record.date)) {
    return null;
  }

  if (!Number.isFinite(record.duration) || record.duration <= 0) {
    return null;
  }

  return {
    ...record,
    completed: Boolean(record.completed)
  };
};

export const getRecentDateRange = (days: number): { startDate: string; endDate: string; dates: string[] } => {
  const end = dayjs().startOf('day');
  const start = end.subtract(days - 1, 'day');

  const dates: string[] = [];
  for (let i = 0; i < days; i += 1) {
    dates.push(start.add(i, 'day').format('YYYY-MM-DD'));
  }

  return {
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
    dates
  };
};

export const buildDailyHeatmapPoints = (
  records: WorkoutRecordEntity[],
  orderedDates: string[]
): DailyHeatmapPoint[] => {
  const grouped = new Map<string, WorkoutRecordEntity[]>();

  records.forEach((record) => {
    const sanitized = sanitizeRecord(record);
    if (!sanitized) {
      return;
    }

    const list = grouped.get(sanitized.date) ?? [];
    list.push(sanitized);
    grouped.set(sanitized.date, list);
  });

  return orderedDates.map((date) => {
    const dayRecords = grouped.get(date) ?? [];
    const totalDuration = dayRecords.reduce((sum, item) => sum + item.duration, 0);
    const completedCount = dayRecords.filter((item) => item.completed).length;

    return {
      date,
      count: dayRecords.length,
      completedCount,
      totalDuration,
      intensityLevel: getIntensityLevel(dayRecords.length, totalDuration),
      records: dayRecords
    };
  });
};

export const buildHeatmapRows = (points: DailyHeatmapPoint[], daysPerRow = 7): DailyHeatmapPoint[][] => {
  const rows: DailyHeatmapPoint[][] = [];

  for (let i = 0; i < points.length; i += daysPerRow) {
    rows.push(points.slice(i, i + daysPerRow));
  }

  return rows;
};

export const buildHeatmapColumnsFromRows = (rows: DailyHeatmapPoint[][]): Array<Array<0 | 1 | 2 | 3 | 4>> => {
  if (rows.length === 0) {
    return [];
  }

  const columns: Array<Array<0 | 1 | 2 | 3 | 4>> = Array.from({ length: rows[0].length }, () => []);

  rows.forEach((row) => {
    row.forEach((point, idx) => {
      columns[idx].push(point.intensityLevel);
    });
  });

  return columns;
};

export const calculateWorkoutSummary = (points: DailyHeatmapPoint[]): WorkoutSummary => {
  const trainingDays = points.filter((point) => point.count > 0).length;
  const totalDuration = points.reduce((sum, point) => sum + point.totalDuration, 0);

  let streakDays = 0;
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].count > 0) {
      streakDays += 1;
      continue;
    }

    break;
  }

  return {
    trainingDays,
    totalDuration,
    streakDays
  };
};
