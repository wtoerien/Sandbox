import { TemplateForm } from "@/components/template-form";

export default function NewTemplatePage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Job Template</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <TemplateForm />
      </div>
    </div>
  );
}
