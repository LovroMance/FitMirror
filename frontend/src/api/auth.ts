import { http } from './http';
import type { AuthSuccessPayload, AuthUser } from '@/types/auth';
import axios from 'axios';

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

export const registerApi = async (payload: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthSuccessPayload> => {
  try {
    const { data } = await http.post<ApiResponse<AuthSuccessPayload>>('/auth/register', payload);
    return unwrapResponse(data);
  } catch (error) {
    return rethrowApiError(error);
  }
};

export const loginApi = async (payload: { account: string; password: string }): Promise<AuthSuccessPayload> => {
  try {
    const { data } = await http.post<ApiResponse<AuthSuccessPayload>>('/auth/login', payload);
    return unwrapResponse(data);
  } catch (error) {
    return rethrowApiError(error);
  }
};

export const meApi = async (): Promise<AuthUser> => {
  try {
    const { data } = await http.get<ApiResponse<AuthUser>>('/auth/me');
    return unwrapResponse(data);
  } catch (error) {
    return rethrowApiError(error);
  }
};
