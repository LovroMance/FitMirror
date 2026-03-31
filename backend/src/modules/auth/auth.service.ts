import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import type { SafeUser } from '../../types/auth';
import { HttpError } from '../../utils/http-error';
import { toSafeUser } from './auth.mapper';
import { authRepository } from './auth.repository';
import type { LoginInput, RegisterInput } from './auth.schema';

const createToken = (user: User): string => {
  const signOptions: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] };

  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email
    },
    env.jwtSecret,
    signOptions
  );
};

export const registerUser = async (input: RegisterInput): Promise<{ user: SafeUser; token: string }> => {
  const existing = await authRepository.findByEmailOrUsername(input.email, input.username);

  if (existing) {
    if (existing.email === input.email) {
      throw new HttpError('Email already exists', 409, 40901);
    }

    throw new HttpError('Username already exists', 409, 40902);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await authRepository.createUser(input.email, input.username, passwordHash);

  return {
    user: toSafeUser(user),
    token: createToken(user)
  };
};

export const loginUser = async (input: LoginInput): Promise<{ user: SafeUser; token: string }> => {
  const user = await authRepository.findByAccount(input.account);

  if (!user) {
    throw new HttpError('Invalid account or password', 401, 40102);
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) {
    throw new HttpError('Invalid account or password', 401, 40102);
  }

  return {
    user: toSafeUser(user),
    token: createToken(user)
  };
};

export const getCurrentUser = async (id: number): Promise<SafeUser> => {
  const user = await authRepository.findById(id);

  if (!user) {
    throw new HttpError('User not found', 404, 40401);
  }

  return toSafeUser(user);
};
