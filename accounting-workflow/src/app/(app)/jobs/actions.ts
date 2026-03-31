"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createJob(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Unauthorized";

  const clientId = formData.get("clientId") as string;
  const title = formData.get("title") as string;
  if (!clientId || !title) return "Client and title are required";

  const templateId = (formData.get("templateId") as string) || null;
  const dueDateRaw = formData.get("dueDate") as string;

  let steps: { create: { order: number; name: string; description: string | null; templateStepId: string | null; isRequired?: boolean }[] } | undefined;

  if (templateId) {
    const template = await db.jobTemplate.findUnique({
      where: { id: templateId },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (template) {
      steps = {
        create: template.steps.map((s) => ({
          order: s.order,
          name: s.name,
          description: s.description,
          templateStepId: s.id,
          status: "PENDING",
        })),
      };
    }
  }

  const job = await db.job.create({
    data: {
      title,
      description: (formData.get("description") as string) || null,
      status: (formData.get("status") as string) || "NOT_STARTED",
      priority: (formData.get("priority") as string) || "MEDIUM",
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      clientId,
      templateId,
      assignedToId: (formData.get("assignedToId") as string) || null,
      createdById: session.id,
      financialYear: (formData.get("financialYear") as string) || null,
      notes: (formData.get("notes") as string) || null,
      ...(steps ? { steps } : {}),
    },
  });

  revalidatePath("/jobs");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/jobs/${job.id}`);
}

export async function updateJob(_prev: string | null, formData: FormData) {
  const session = await getSession();
  if (!session) return "Unauthorized";

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  if (!title) return "Title is required";

  const dueDateRaw = formData.get("dueDate") as string;

  await db.job.update({
    where: { id },
    data: {
      title,
      description: (formData.get("description") as string) || null,
      status: formData.get("status") as string,
      priority: formData.get("priority") as string,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      assignedToId: (formData.get("assignedToId") as string) || null,
      financialYear: (formData.get("financialYear") as string) || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  redirect(`/jobs/${id}`);
}

export async function updateJobStepStatus(_prev: null, formData: FormData) {
  const session = await getSession();
  if (!session) return null;

  const stepId = formData.get("stepId") as string;
  const status = formData.get("status") as string;
  const jobId = formData.get("jobId") as string;

  await db.jobStep.update({
    where: { id: stepId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  // Auto-update job status based on steps
  const allSteps = await db.jobStep.findMany({ where: { jobId } });
  const allCompleted = allSteps.every((s) => s.status === "COMPLETED" || s.status === "SKIPPED");
  const anyInProgress = allSteps.some((s) => s.status === "IN_PROGRESS");

  if (allCompleted && allSteps.length > 0) {
    await db.job.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date() } });
  } else if (anyInProgress) {
    await db.job.update({ where: { id: jobId }, data: { status: "IN_PROGRESS" } });
  }

  revalidatePath(`/jobs/${jobId}`);
  return null;
}
