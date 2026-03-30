import axios from 'axios';
import { http } from './http';
import type { GeneratePlanPayload, TrainingPlan } from '@/types/plan';

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

export const generatePlanApi = async (goalText: string): Promise<TrainingPlan> => {
  try {
    const { data } = await http.post<ApiResponse<GeneratePlanPayload>>('/plans/generate', { goalText });
    const payload = unwrapResponse(data);
    return payload.plan;
  } catch (error) {
    return rethrowApiError(error);
  }
};
