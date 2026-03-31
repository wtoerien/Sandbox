"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updatePractice(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return "Unauthorized";

  const id = formData.get("id") as string;
  if (!id) return "Practice not found";

  await db.practice.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || null,
      address: (formData.get("address") as string) || null,
      taxNumber: (formData.get("taxNumber") as string) || null,
    },
  });

  revalidatePath("/practice");
  return null;
}
