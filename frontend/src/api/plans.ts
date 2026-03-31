import axios from 'axios';
import { http } from './http';
import type { GeneratePlanPayload, PlanStreamEvent, PlanSource, TrainingPlan } from '@/types/plan';

interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  error?: string;
}

interface GeneratePlanResult {
  plan: TrainingPlan;
  source?: PlanSource;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api';
const TOKEN_KEY = 'fitmirror_token';

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

const readSseStream = async (
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: PlanStreamEvent) => void
): Promise<GeneratePlanResult> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');

  let buffer = '';
  let completedResult: GeneratePlanResult | null = null;

  const parseChunk = (chunk: string): void => {
    const blocks = chunk.split('\n\n');
    buffer = blocks.pop() ?? '';

    blocks.forEach((block) => {
      const lines = block.split('\n');
      let eventType = 'message';
      const dataLines: string[] = [];

      lines.forEach((line) => {
        if (line.startsWith('event:')) {
          eventType = line.slice('event:'.length).trim();
          return;
        }

        if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trim());
        }
      });

      const dataText = dataLines.join('\n');
      if (!dataText) {
        return;
      }

      let payload: PlanStreamEvent;
      try {
        payload = JSON.parse(dataText) as PlanStreamEvent;
      } catch {
        payload = {
          type: 'error',
          message: '流式响应解析失败'
        };
      }

      if (eventType === 'error' || payload.type === 'error') {
        throw new Error(payload.message || '计划生成失败，请稍后重试');
      }

      onEvent(payload);

      if (payload.type === 'completed' && payload.plan) {
        completedResult = {
          plan: payload.plan,
          source: payload.source
        };
      }
    });
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) {
        parseChunk(`${buffer}\n\n`);
      }
      break;
    }

    parseChunk(decoder.decode(value, { stream: true }));
  }

  if (!completedResult) {
    throw new Error('计划生成失败，请稍后重试');
  }

  return completedResult;
};

export const generatePlanApiWithSource = async (goalText: string): Promise<GeneratePlanResult> => {
  try {
    const { data } = await http.post<ApiResponse<GeneratePlanPayload>>('/plans/generate', { goalText });
    const payload = unwrapResponse(data);
    return {
      plan: payload.plan,
      source: payload.source
    };
  } catch (error) {
    return rethrowApiError(error);
  }
};

export const generatePlanApi = async (goalText: string): Promise<TrainingPlan> => {
  const result = await generatePlanApiWithSource(goalText);
  return result.plan;
};

export const generatePlanStream = async (
  goalText: string,
  onEvent: (event: PlanStreamEvent) => void,
  options?: { timeoutMs?: number }
): Promise<GeneratePlanResult> => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    throw new Error('登录状态已失效，请重新登录');
  }

  const timeoutMs = options?.timeoutMs ?? 12000;
  const requestUrl = `${API_BASE_URL}/plans/generate/stream?goalText=${encodeURIComponent(goalText)}`;
  const abortController = new AbortController();
  let timerId = 0;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = window.setTimeout(() => {
      abortController.abort();
      reject(new Error('生成超时，已切换稳定通道重试'));
    }, timeoutMs);
  });

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
      signal: abortController.signal
    });
  } catch (error) {
    window.clearTimeout(timerId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('生成超时，已切换稳定通道重试');
    }

    throw error;
  }

  try {
    if (!response.ok) {
      try {
        const body = (await response.json()) as ApiResponse<never>;
        throw new Error(body.error || body.message || '计划生成失败，请稍后重试');
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }

        throw new Error('计划生成失败，请稍后重试');
      }
    }

    if (!response.body) {
      throw new Error('流式响应不可用，请稍后重试');
    }

    return await Promise.race([readSseStream(response.body, onEvent), timeoutPromise]);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('生成超时，已切换稳定通道重试');
    }

    throw error;
  } finally {
    window.clearTimeout(timerId);
    abortController.abort();
  }
};

