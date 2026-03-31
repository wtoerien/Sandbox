"use server";

import { login } from "@/lib/auth";
import { seedIfEmpty } from "@/lib/seed";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(_prev: string | null, formData: FormData) {
  await seedIfEmpty();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = await login(email, password);

  if (!user) {
    return "Invalid email or password";
  }

  const cookieStore = await cookies();
  cookieStore.set("userId", user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  redirect("/dashboard");
}
