import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  hash: vi.fn(),
  compare: vi.fn(),
  sign: vi.fn()
}));

vi.mock('./auth.repository', () => ({
  authRepository: {
    findByEmailOrUsername: authMocks.findFirst,
    findByAccount: authMocks.findFirst,
    findById: authMocks.findUnique,
    createUser: authMocks.create
  }
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: authMocks.hash,
    compare: authMocks.compare
  }
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: authMocks.sign
  }
}));

import type { HttpError } from '../../utils/http-error';
import { loginUser, registerUser } from './auth.service';

const baseUser = {
  id: 1,
  email: 'demo@test.com',
  username: 'demo',
  passwordHash: 'hashed-password',
  createdAt: new Date('2026-03-31T00:00:00.000Z'),
  updatedAt: new Date('2026-03-31T00:00:00.000Z')
};

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects duplicate email during registration', async () => {
    authMocks.findFirst.mockResolvedValue({
      ...baseUser,
      email: 'demo@test.com'
    });

    await expect(
      registerUser({
        email: 'demo@test.com',
        username: 'new-user',
        password: 'password123'
      })
    ).rejects.toMatchObject<HttpError>({
      message: 'Email already exists',
      statusCode: 409,
      code: 40901
    });
  });

  it('registers a new user and returns a token', async () => {
    authMocks.findFirst.mockResolvedValue(null);
    authMocks.hash.mockResolvedValue('hashed-password');
    authMocks.create.mockResolvedValue(baseUser);
    authMocks.sign.mockReturnValue('signed-token');

    const result = await registerUser({
      email: 'demo@test.com',
      username: 'demo',
      password: 'password123'
    });

    expect(authMocks.hash).toHaveBeenCalledWith('password123', 10);
    expect(result.token).toBe('signed-token');
    expect(result.user.username).toBe('demo');
  });

  it('rejects login when account does not exist', async () => {
    authMocks.findFirst.mockResolvedValue(null);

    await expect(
      loginUser({
        account: 'missing@test.com',
        password: 'password123'
      })
    ).rejects.toMatchObject<HttpError>({
      message: 'Invalid account or password',
      statusCode: 401,
      code: 40102
    });
  });

  it('rejects login when password check fails', async () => {
    authMocks.findFirst.mockResolvedValue(baseUser);
    authMocks.compare.mockResolvedValue(false);

    await expect(
      loginUser({
        account: 'demo@test.com',
        password: 'wrong-password'
      })
    ).rejects.toMatchObject<HttpError>({
      message: 'Invalid account or password',
      statusCode: 401,
      code: 40102
    });
  });

  it('returns user info and token when login succeeds', async () => {
    authMocks.findFirst.mockResolvedValue(baseUser);
    authMocks.compare.mockResolvedValue(true);
    authMocks.sign.mockReturnValue('signed-token');

    const result = await loginUser({
      account: 'demo@test.com',
      password: 'password123'
    });

    expect(result.token).toBe('signed-token');
    expect(result.user).toMatchObject({
      id: 1,
      email: 'demo@test.com',
      username: 'demo'
    });
  });
});
