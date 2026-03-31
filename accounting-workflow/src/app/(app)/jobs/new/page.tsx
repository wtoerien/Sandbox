import { db } from "@/lib/db";
import { JobForm } from "@/components/job-form";

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;

  const [clients, templates, users] = await Promise.all([
    db.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.jobTemplate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
  ]);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Job</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <JobForm clients={clients} templates={templates} users={users} defaultClientId={clientId} />
      </div>
    </div>
  );
}
