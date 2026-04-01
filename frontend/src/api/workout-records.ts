import axios from 'axios';
import { http } from './http';
import type { SyncWorkoutRecordsResult, WorkoutRecordSyncPayload } from '@/types/workout';

interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

const unwrapResponse = <T>(response: ApiResponse<T>): T => {
  if (response.code !== 0 || !response.data) {
    throw new Error(response.error || response.message || 'Request failed');
  }

  return response.data;
};

const rethrowApiError = (error: unknown): never => {
  if (axios.isAxiosError<ApiResponse<never>>(error)) {
    const responseData = error.response?.data;
    const message = responseData?.error || responseData?.message || error.message;
    throw new Error(message);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error('Request failed');
};

export const syncWorkoutRecordsApi = async (records: WorkoutRecordSyncPayload[]): Promise<SyncWorkoutRecordsResult> => {
  try {
    const { data } = await http.post<ApiResponse<SyncWorkoutRecordsResult>>('/workout-records/sync', { records });
    return unwrapResponse(data);
  } catch (error) {
    return rethrowApiError(error);
  }
};
