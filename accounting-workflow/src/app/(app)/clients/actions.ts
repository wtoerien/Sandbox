"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClient(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Unauthorized";

  const data = {
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
    taxFileNumber: (formData.get("taxFileNumber") as string) || null,
    abn: (formData.get("abn") as string) || null,
    clientType: (formData.get("clientType") as string) || "INDIVIDUAL",
    notes: (formData.get("notes") as string) || null,
    isActive: formData.get("isActive") === "true",
  };

  if (!data.code || !data.name) return "Code and name are required";

  const existing = await db.client.findUnique({ where: { code: data.code } });
  if (existing) return "A client with this code already exists";

  const client = await db.client.create({ data });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Unauthorized";

  const id = formData.get("id") as string;
  const data = {
    code: formData.get("code") as string,
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
    taxFileNumber: (formData.get("taxFileNumber") as string) || null,
    abn: (formData.get("abn") as string) || null,
    clientType: (formData.get("clientType") as string) || "INDIVIDUAL",
    notes: (formData.get("notes") as string) || null,
    isActive: formData.get("isActive") === "true",
  };

  if (!data.code || !data.name) return "Code and name are required";

  const existing = await db.client.findFirst({ where: { code: data.code, NOT: { id } } });
  if (existing) return "A client with this code already exists";

  await db.client.update({ where: { id }, data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}
