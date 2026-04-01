import { HttpError } from '../../utils/http-error';

export interface WorkoutRecordSyncInput {
  clientRecordId: string;
  date: string;
  duration: number;
  completed: boolean;
  planId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncWorkoutRecordsBody {
  records: WorkoutRecordSyncInput[];
}

const isIsoDateString = (value: string): boolean => !Number.isNaN(Date.parse(value));
const isDateOnlyString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseOneRecord = (value: unknown): WorkoutRecordSyncInput => {
  const payload = value as Record<string, unknown>;
  const clientRecordId = String(payload.clientRecordId ?? '').trim();
  const date = String(payload.date ?? '').trim();
  const duration = Number(payload.duration);
  const completed = Boolean(payload.completed);
  const createdAt = String(payload.createdAt ?? '').trim();
  const updatedAt = String(payload.updatedAt ?? '').trim();
  const rawPlanId = payload.planId;

  if (!clientRecordId || !date || !Number.isFinite(duration) || duration <= 0 || !createdAt || !updatedAt) {
    throw new HttpError('Invalid workout record payload', 400, 40011);
  }

  if (!isDateOnlyString(date) || !isIsoDateString(createdAt) || !isIsoDateString(updatedAt)) {
    throw new HttpError('Invalid workout record date fields', 400, 40012);
  }

  const planId =
    typeof rawPlanId === 'number' && Number.isFinite(rawPlanId) && rawPlanId > 0 ? Math.round(rawPlanId) : undefined;

  return {
    clientRecordId,
    date,
    duration: Math.round(duration),
    completed,
    ...(typeof planId === 'number' ? { planId } : {}),
    createdAt,
    updatedAt
  };
};

export const parseSyncWorkoutRecordsBody = (body: unknown): SyncWorkoutRecordsBody => {
  const payload = body as Record<string, unknown>;
  const records = Array.isArray(payload.records) ? payload.records.map((item) => parseOneRecord(item)) : null;

  if (!records) {
    throw new HttpError('Invalid workout records payload', 400, 40010);
  }

  return { records };
};
