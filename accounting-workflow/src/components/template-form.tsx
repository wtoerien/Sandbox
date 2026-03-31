"use client";

import { useActionState, useState } from "react";
import { createTemplate, updateTemplate } from "@/app/(app)/templates/actions";
import type { JobTemplate, TemplateStep } from "@prisma/client";
import Link from "next/link";

type StepInput = { name: string; description: string; isRequired: boolean };

type TemplateWithSteps = JobTemplate & { steps: TemplateStep[] };

export function TemplateForm({ template }: { template?: TemplateWithSteps }) {
  const action = template ? updateTemplate : createTemplate;
  const [error, formAction, pending] = useActionState(action, null);

  const [steps, setSteps] = useState<StepInput[]>(
    template?.steps.map((s) => ({ name: s.name, description: s.description ?? "", isRequired: s.isRequired })) ?? []
  );

  function addStep() {
    setSteps([...steps, { name: "", description: "", isRequired: true }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof StepInput, value: string | boolean) {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  }

  function moveStep(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === steps.length - 1) return;
    const newSteps = [...steps];
    const swap = direction === "up" ? index - 1 : index + 1;
    [newSteps[index], newSteps[swap]] = [newSteps[swap], newSteps[index]];
    setSteps(newSteps);
  }

  return (
    <form action={formAction} className="space-y-4">
      {template && <input type="hidden" name="id" value={template.id} />}
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />

      <div>
        <label className="block text-sm font-medium text-gray-700">Template Name *</label>
        <input
          name="name"
          defaultValue={template?.name}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={template?.description ?? ""}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <select
            name="category"
            defaultValue={template?.category ?? ""}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No category</option>
            <option value="TAX_RETURN">Tax Return</option>
            <option value="BAS">BAS</option>
            <option value="BOOKKEEPING">Bookkeeping</option>
            <option value="AUDIT">Audit</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            name="isActive"
            defaultValue={template?.isActive === false ? "false" : "true"}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Steps editor */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700">Steps</label>
          <button
            type="button"
            onClick={addStep}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add Step
          </button>
        </div>
        {steps.length === 0 && (
          <p className="text-sm text-gray-400 py-2">No steps. Click "Add Step" to add workflow steps.</p>
        )}
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 w-5 text-center">{index + 1}</span>
                <input
                  value={step.name}
                  onChange={(e) => updateStep(index, "name", e.target.value)}
                  placeholder="Step name *"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button type="button" onClick={() => moveStep(index, "up")} className="text-gray-400 hover:text-gray-600 text-xs">↑</button>
                <button type="button" onClick={() => moveStep(index, "down")} className="text-gray-400 hover:text-gray-600 text-xs">↓</button>
                <button type="button" onClick={() => removeStep(index)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
              </div>
              <div className="flex items-center gap-2 ml-7">
                <input
                  value={step.description}
                  onChange={(e) => updateStep(index, "description", e.target.value)}
                  placeholder="Description (optional)"
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={step.isRequired}
                    onChange={(e) => updateStep(index, "isRequired", e.target.checked)}
                  />
                  Required
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving..." : template ? "Update Template" : "Create Template"}
        </button>
        <Link
          href={template ? `/templates/${template.id}` : "/templates"}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
