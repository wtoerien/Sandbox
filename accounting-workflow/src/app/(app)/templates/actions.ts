"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTemplate(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Unauthorized";

  const name = formData.get("name") as string;
  if (!name) return "Name is required";

  const stepsRaw = formData.get("steps") as string;
  let steps: { name: string; description: string; isRequired: boolean }[] = [];
  try {
    steps = JSON.parse(stepsRaw || "[]");
  } catch {
    return "Invalid steps data";
  }

  const template = await db.jobTemplate.create({
    data: {
      name,
      description: (formData.get("description") as string) || null,
      category: (formData.get("category") as string) || null,
      isActive: formData.get("isActive") === "true",
      steps: {
        create: steps.map((step, index) => ({
          order: index + 1,
          name: step.name,
          description: step.description || null,
          isRequired: step.isRequired,
        })),
      },
    },
  });

  revalidatePath("/templates");
  redirect(`/templates/${template.id}`);
}

export async function updateTemplate(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Unauthorized";

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  if (!name) return "Name is required";

  const stepsRaw = formData.get("steps") as string;
  let steps: { name: string; description: string; isRequired: boolean }[] = [];
  try {
    steps = JSON.parse(stepsRaw || "[]");
  } catch {
    return "Invalid steps data";
  }

  await db.templateStep.deleteMany({ where: { templateId: id } });

  await db.jobTemplate.update({
    where: { id },
    data: {
      name,
      description: (formData.get("description") as string) || null,
      category: (formData.get("category") as string) || null,
      isActive: formData.get("isActive") === "true",
      steps: {
        create: steps.map((step, index) => ({
          order: index + 1,
          name: step.name,
          description: step.description || null,
          isRequired: step.isRequired,
        })),
      },
    },
  });

  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
  redirect(`/templates/${id}`);
}
