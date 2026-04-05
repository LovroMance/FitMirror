import axios from 'axios';
import { http } from './http';
import type { NutritionRecommendationResult, RecommendNutritionPayload } from '@/types/nutrition';

interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

const NUTRITION_REQUEST_TIMEOUT_MS = 20000;

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

export const recommendNutritionApi = async (
  payload: RecommendNutritionPayload
): Promise<NutritionRecommendationResult> => {
  try {
    const { data } = await http.post<ApiResponse<NutritionRecommendationResult>>('/nutrition/recommend', payload, {
      timeout: NUTRITION_REQUEST_TIMEOUT_MS
    });
    return unwrapResponse(data);
  } catch (error) {
    return rethrowApiError(error);
  }
};
