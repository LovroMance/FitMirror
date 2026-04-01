import axios from 'axios';
import { http } from './http';
import type { SyncPlansRequest, SyncPlansResult } from '@/types/plan';

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

export const syncPlansApi = async (payload: SyncPlansRequest): Promise<SyncPlansResult> => {
  try {
    const { data } = await http.post<ApiResponse<SyncPlansResult>>('/plans/sync', payload);
    return unwrapResponse(data);
  } catch (error) {
    return rethrowApiError(error);
  }
};
