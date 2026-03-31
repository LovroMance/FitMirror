import type { User } from '@prisma/client';
import type { SafeUser } from '../../types/auth';

export const toSafeUser = (user: User): SafeUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
