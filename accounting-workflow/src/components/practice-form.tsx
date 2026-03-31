"use client";

import { useActionState } from "react";
import { updatePractice } from "@/app/(app)/practice/actions";
import type { Practice } from "@prisma/client";

export function PracticeForm({ practice, canEdit }: { practice: Practice; canEdit: boolean }) {
  const [result, formAction, pending] = useActionState(updatePractice, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={practice.id} />

      <div>
        <label className="block text-sm font-medium text-gray-700">Practice Name *</label>
        <input
          name="name"
          defaultValue={practice.name}
          required
          disabled={!canEdit}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Practice Email *</label>
        <input
          name="email"
          type="email"
          defaultValue={practice.email}
          required
          disabled={!canEdit}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Phone</label>
        <input
          name="phone"
          defaultValue={practice.phone ?? ""}
          disabled={!canEdit}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Address</label>
        <input
          name="address"
          defaultValue={practice.address ?? ""}
          disabled={!canEdit}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tax Number / ABN</label>
        <input
          name="taxNumber"
          defaultValue={practice.taxNumber ?? ""}
          disabled={!canEdit}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      {result === null && !pending && (
        <p className="text-sm text-green-600">Saved successfully.</p>
      )}
      {typeof result === "string" && result && (
        <p className="text-sm text-red-600">{result}</p>
      )}

      {canEdit && (
        <div className="pt-4">
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-gray-500 italic">Only admins can edit practice settings.</p>
      )}
    </form>
  );
}
