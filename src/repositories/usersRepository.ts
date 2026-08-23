import { prisma } from "../lib/prisma.ts";

export const findUserByEmail = (email: string) => prisma.user.findUnique({ where: { email } });

export const createUser = (data: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
}) => prisma.user.create({ data });
