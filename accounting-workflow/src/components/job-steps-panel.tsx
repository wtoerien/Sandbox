"use client";

import { useActionState } from "react";
import { updateJobStepStatus } from "@/app/(app)/jobs/actions";
import type { JobStep } from "@prisma/client";

const stepStatusOptions = [
  { value: "PENDING", label: "Pending", color: "bg-gray-100 text-gray-700" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-700" },
  { value: "SKIPPED", label: "Skipped", color: "bg-gray-100 text-gray-400" },
];

function StepRow({ step, jobId }: { step: JobStep; jobId: string }) {
  const [, formAction, pending] = useActionState(updateJobStepStatus, null);

  const current = stepStatusOptions.find((s) => s.value === step.status);

  return (
    <div className={`p-4 flex items-center gap-3 ${step.status === "COMPLETED" ? "opacity-75" : ""}`}>
      <span className="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-600 rounded-full text-xs font-medium flex items-center justify-center">
        {step.status === "COMPLETED" ? "✓" : step.order}
      </span>
      <div className="flex-1">
        <div className={`font-medium text-gray-900 ${step.status === "COMPLETED" ? "line-through text-gray-400" : ""}`}>
          {step.name}
        </div>
        {step.description && <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>}
        {step.notes && <p className="text-xs text-blue-600 mt-1 italic">{step.notes}</p>}
        {step.completedAt && (
          <p className="text-xs text-green-600 mt-0.5">Completed {new Date(step.completedAt).toLocaleDateString()}</p>
        )}
      </div>
      <form action={formAction}>
        <input type="hidden" name="stepId" value={step.id} />
        <input type="hidden" name="jobId" value={jobId} />
        <select
          name="status"
          defaultValue={step.status}
          onChange={(e) => {
            const form = e.target.closest("form") as HTMLFormElement;
            form?.requestSubmit();
          }}
          disabled={pending}
          className={`text-xs px-2 py-1 rounded border-0 cursor-pointer ${current?.color} focus:outline-none focus:ring-1 focus:ring-blue-500`}
        >
          {stepStatusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </form>
    </div>
  );
}

export function JobStepsPanel({ steps, jobId }: { steps: JobStep[]; jobId: string }) {
  return (
    <div className="divide-y divide-gray-200">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} jobId={jobId} />
      ))}
    </div>
  );
}
