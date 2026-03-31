import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await db.jobTemplate.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { jobs: true } },
    },
  });

  if (!template) notFound();

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/templates" className="text-sm text-gray-500 hover:text-gray-700">← Templates</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{template.name}</h1>
          {template.category && <p className="text-gray-500">{template.category.replace("_", " ")}</p>}
        </div>
        <Link href={`/templates/${id}/edit`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50">
          Edit
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between mb-4">
          {template.description && <p className="text-gray-600">{template.description}</p>}
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{template.steps.length} steps</span>
            <span>{template._count.jobs} jobs used</span>
            <span className={template.isActive ? "text-green-600" : "text-gray-400"}>
              {template.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Steps</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {template.steps.map((step) => (
            <div key={step.id} className="p-4 flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center justify-center mt-0.5">
                {step.order}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{step.name}</span>
                  {!step.isRequired && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">Optional</span>
                  )}
                </div>
                {step.description && <p className="text-sm text-gray-500 mt-1">{step.description}</p>}
              </div>
            </div>
          ))}
          {template.steps.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No steps defined.</p>
          )}
        </div>
      </div>
    </div>
  );
}
