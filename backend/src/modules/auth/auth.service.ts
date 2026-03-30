import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import type { SafeUser } from '../../types/auth';
import { HttpError } from '../../utils/http-error';

interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

interface LoginInput {
  account: string;
  password: string;
}

const toSafeUser = (user: User): SafeUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

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
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { username: input.username }]
    }
  });

  if (existing) {
    if (existing.email === input.email) {
      throw new HttpError('Email already exists', 409, 40901);
    }

    throw new HttpError('Username already exists', 409, 40902);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash
    }
  });

  return {
    user: toSafeUser(user),
    token: createToken(user)
  };
};

export const loginUser = async (input: LoginInput): Promise<{ user: SafeUser; token: string }> => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.account }, { username: input.account }]
    }
  });

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
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    throw new HttpError('User not found', 404, 40401);
  }

  return toSafeUser(user);
};
