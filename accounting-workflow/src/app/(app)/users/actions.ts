"use server";

import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createUser(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) return "Unauthorized";

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  if (!email || !password || !firstName || !lastName) return "All fields are required";
  if (password.length < 8) return "Password must be at least 8 characters";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return "A user with this email already exists";

  await db.user.create({
    data: {
      email,
      password: await hashPassword(password),
      firstName,
      lastName,
      role: (formData.get("role") as string) || "STAFF",
      isActive: formData.get("isActive") === "true",
      practiceId: session.practiceId,
    },
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function updateUser(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) return "Unauthorized";

  const id = formData.get("id") as string;
  const email = formData.get("email") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;

  if (!email || !firstName || !lastName) return "All fields are required";

  const existing = await db.user.findFirst({ where: { email, NOT: { id } } });
  if (existing) return "A user with this email already exists";

  const passwordRaw = formData.get("password") as string;
  const updateData: Record<string, unknown> = {
    email,
    firstName,
    lastName,
    role: formData.get("role") as string,
    isActive: formData.get("isActive") === "true",
  };
  if (passwordRaw && passwordRaw.length > 0) {
    if (passwordRaw.length < 8) return "Password must be at least 8 characters";
    updateData.password = await hashPassword(passwordRaw);
  }

  await db.user.update({ where: { id }, data: updateData });
  revalidatePath("/users");
  redirect("/users");
}
