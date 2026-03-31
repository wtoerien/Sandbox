import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { JobEditForm } from "@/components/job-edit-form";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, users] = await Promise.all([
    db.job.findUnique({ where: { id } }),
    db.user.findMany({ where: { isActive: true }, orderBy: { firstName: "asc" } }),
  ]);
  if (!job) notFound();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Job</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <JobEditForm job={job} users={users} />
      </div>
    </div>
  );
}
