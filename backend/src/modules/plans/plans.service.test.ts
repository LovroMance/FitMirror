import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosPostMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    post: axiosPostMock,
    isAxiosError: (error: unknown) => typeof error === 'object' && error !== null && 'response' in error
  }
}));

import { env } from '../../config/env';
import { generatePlanFromGoal, generatePlanWithFallback } from './plans.service';

describe('plans.service', () => {
  const originalApiKey = env.deepseekApiKey;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    env.deepseekApiKey = originalApiKey;
  });

  it('falls back to template generation when api key is missing', async () => {
    env.deepseekApiKey = '';
    const events: string[] = [];

    const result = await generatePlanWithFallback('我想瘦肚子，每天10分钟，无器械', (event) => {
      events.push(`${event.type}:${event.reason ?? event.source ?? ''}`);
    });

    expect(result.source).toBe('template');
    expect(events).toContain('llm_failed:missing_api_key');
    expect(events).toContain('fallback_start:');
  });

  it('returns deepseek result when provider response is valid', async () => {
    env.deepseekApiKey = 'deepseek-test-key';
    axiosPostMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '12分钟核心训练',
                level: 'beginner',
                durationMinutes: 12,
                summary: '重点加强核心稳定与基础耐力，训练前热身，训练后拉伸，保持稳定呼吸与动作控制。',
                exercises: [
                  { name: '热身', durationSeconds: 40, restSeconds: 15, instruction: '热身时逐步提升心率并激活核心肌群。' },
                  { name: '平板支撑', durationSeconds: 40, restSeconds: 20, instruction: '保持肩髋踝一线，收紧腹部避免塌腰。' },
                  { name: '死虫式', reps: '左右各10次', restSeconds: 20, instruction: '下背部贴地，缓慢控制四肢对侧伸展。' },
                  { name: '仰卧交替抬腿', reps: '12次', restSeconds: 20, instruction: '抬腿时呼气卷腹，下放过程保持慢速控制。' },
                  { name: '侧桥支撑', durationSeconds: 30, restSeconds: 20, instruction: '左右两侧交替进行，避免髋部下沉。' }
                ]
              })
            }
          }
        ]
      }
    });

    const result = await generatePlanWithFallback('我想练核心，每天12分钟');

    expect(result.source).toBe('deepseek');
    expect(result.plan.title).toBe('12分钟核心训练');
    expect(axiosPostMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to template generation when provider returns invalid json', async () => {
    env.deepseekApiKey = 'deepseek-test-key';
    axiosPostMock.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'not-json'
            }
          }
        ]
      }
    });

    const events: string[] = [];
    const result = await generatePlanWithFallback('我想练核心，每天12分钟', (event) => {
      events.push(`${event.type}:${event.reason ?? event.source ?? ''}`);
    });

    expect(result.source).toBe('template');
    expect(result.plan.exercises.length).toBeGreaterThanOrEqual(5);
    expect(events).toContain('llm_failed:invalid_response');
    expect(events).toContain('fallback_start:');
  });
  it('builds targeted fallback plan for back-focused goal', () => {
    const plan = generatePlanFromGoal('我今天要练背，着重练中下背');
    const names = plan.exercises.map((item) => item.name).join(' ');

    expect(plan.exercises.length).toBeGreaterThanOrEqual(5);
    expect(names).toMatch(/划船|超人|靠墙天使|鸟狗|背/);
  });

  it('keeps no-equipment preference in smart fallback', () => {
    const plan = generatePlanFromGoal('居家无器械练背，重点中下背');

    expect(plan.summary).toContain('无器械');
    expect(plan.exercises.length).toBeGreaterThanOrEqual(5);
  });
});

