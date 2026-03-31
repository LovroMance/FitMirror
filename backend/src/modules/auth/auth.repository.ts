import { prisma } from '../../lib/prisma';

export const authRepository = {
  findByEmailOrUsername(email: string, username: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });
  },

  findByAccount(account: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ email: account }, { username: account }]
      }
    });
  },

  createUser(email: string, username: string, passwordHash: string) {
    return prisma.user.create({
      data: {
        email,
        username,
        passwordHash
      }
    });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  }
};
