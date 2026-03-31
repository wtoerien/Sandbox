import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { TemplateForm } from "@/components/template-form";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = await db.jobTemplate.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!template) notFound();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Template</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <TemplateForm template={template} />
      </div>
    </div>
  );
}
