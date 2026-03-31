import { HttpError } from '../../utils/http-error';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  account: string;
  password: string;
}

const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const parseRegisterInput = (body: unknown): RegisterInput => {
  const payload = body as Record<string, unknown>;
  const email = String(payload.email ?? '').trim().toLowerCase();
  const username = String(payload.username ?? '').trim();
  const password = String(payload.password ?? '');

  if (!email || !username || !password) {
    throw new HttpError('Missing required fields', 400, 40001);
  }

  if (!isValidEmail(email)) {
    throw new HttpError('Invalid email format', 400, 40002);
  }

  if (username.length < 2 || username.length > 20) {
    throw new HttpError('Username length must be between 2 and 20', 400, 40003);
  }

  if (password.length < 8) {
    throw new HttpError('Password must be at least 8 characters', 400, 40004);
  }

  return { email, username, password };
};

export const parseLoginInput = (body: unknown): LoginInput => {
  const payload = body as Record<string, unknown>;
  const account = String(payload.account ?? '').trim();
  const password = String(payload.password ?? '');

  if (!account || !password) {
    throw new HttpError('Missing required fields', 400, 40001);
  }

  return { account, password };
};
