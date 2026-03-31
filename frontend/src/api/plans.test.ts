import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingPlan } from '@/types/plan';

const postMock = vi.hoisted(() => vi.fn());

vi.mock('./http', () => ({
  http: {
    post: postMock
  }
}));

import { generatePlanApiWithSource, generatePlanStream } from './plans';

class LocalStorageMock {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const samplePlan: TrainingPlan = {
  title: '10分钟居家训练',
  level: 'beginner',
  durationMinutes: 10,
  summary: '适合今天快速完成的训练安排。',
  exercises: [
    {
      name: '开合跳',
      durationSeconds: 40,
      restSeconds: 20,
      instruction: '保持稳定呼吸，落地轻柔。'
    }
  ]
};

const createStream = (chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    }
  });

describe('plans api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new LocalStorageMock();
    storage.setItem('fitmirror_token', 'token-123');
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout
    });
  });

  it('parses SSE events and returns the completed plan', async () => {
    const events: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: createStream([
          'event: queued\ndata: {"type":"queued"}\n\n',
          `event: completed\ndata: ${JSON.stringify({
            type: 'completed',
            source: 'deepseek',
            plan: samplePlan
          })}\n\n`
        ])
      })
    );

    const result = await generatePlanStream(
      '瘦肚子 每天10分钟',
      (event) => {
        events.push(event.type);
      },
      { timeoutMs: 1000 }
    );

    expect(events).toEqual(['queued', 'completed']);
    expect(result).toEqual({ plan: samplePlan, source: 'deepseek' });
  });

  it('turns aborted stream requests into a stable fallback hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    );

    await expect(generatePlanStream('目标', vi.fn(), { timeoutMs: 1 })).rejects.toThrow(
      '生成超时，已切换稳定通道重试'
    );
  });

  it('times out when the SSE response never completes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream<Uint8Array>({
          start() {}
        })
      })
    );

    await expect(generatePlanStream('目标', vi.fn(), { timeoutMs: 10 })).rejects.toThrow(
      '生成超时，已切换稳定通道重试'
    );
  });

  it('returns POST fallback payload with source metadata', async () => {
    postMock.mockResolvedValue({
      data: {
        code: 0,
        message: 'success',
        data: {
          plan: samplePlan,
          source: 'template'
        }
      }
    });

    const result = await generatePlanApiWithSource('目标');

    expect(result).toEqual({
      plan: samplePlan,
      source: 'template'
    });
  });
});
