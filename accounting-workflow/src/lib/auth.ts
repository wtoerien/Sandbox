import { cookies } from "next/headers";
import { db } from "./db";
import bcrypt from "bcryptjs";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  practiceId: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      practiceId: true,
    },
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email, isActive: true },
  });

  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;

  return user;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
