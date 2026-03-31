import { db } from "@/lib/db";
import Link from "next/link";

export default async function TemplatesPage() {
  const templates = await db.jobTemplate.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { steps: true, jobs: true } } },
  });

  const categoryColors: Record<string, string> = {
    TAX_RETURN: "bg-blue-100 text-blue-800",
    BAS: "bg-green-100 text-green-800",
    BOOKKEEPING: "bg-purple-100 text-purple-800",
    AUDIT: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Job Templates</h1>
        <Link
          href="/templates/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + New Template
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {templates.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-500">
            No templates yet. <Link href="/templates/new" className="text-blue-600 hover:underline">Create your first template.</Link>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${template.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {template.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {template.category && (
                <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${categoryColors[template.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {template.category.replace("_", " ")}
                </span>
              )}
              {template.description && (
                <p className="text-sm text-gray-500 mb-3">{template.description}</p>
              )}
              <div className="flex justify-between text-xs text-gray-500 mb-4">
                <span>{template._count.steps} steps</span>
                <span>{template._count.jobs} jobs created</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/templates/${template.id}`} className="flex-1 text-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-sm hover:bg-blue-100">
                  View
                </Link>
                <Link href={`/templates/${template.id}/edit`} className="flex-1 text-center px-3 py-1.5 bg-gray-50 text-gray-700 rounded text-sm hover:bg-gray-100">
                  Edit
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
