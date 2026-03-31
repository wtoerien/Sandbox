import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { JobStepsPanel } from "@/components/job-steps-panel";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.job.findUnique({
    where: { id },
    include: {
      client: true,
      template: true,
      assignedTo: true,
      createdBy: true,
      steps: { orderBy: { order: "asc" } },
    },
  });

  if (!job) notFound();

  const statusColors: Record<string, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    ON_HOLD: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const statusLabels: Record<string, string> = {
    NOT_STARTED: "Not Started",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  const priorityColors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    MEDIUM: "bg-blue-50 text-blue-600",
    HIGH: "bg-orange-100 text-orange-700",
    URGENT: "bg-red-100 text-red-700",
  };

  const completedSteps = job.steps.filter((s) => s.status === "COMPLETED").length;
  const progressPct = job.steps.length > 0 ? Math.round((completedSteps / job.steps.length) * 100) : null;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-700">← Jobs</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{job.title}</h1>
          {job.financialYear && <p className="text-gray-500">Financial Year {job.financialYear}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/jobs/${job.id}/edit`}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Job Details</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-500">Client</dt>
              <dd className="mt-1">
                <Link href={`/clients/${job.client.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  {job.client.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[job.status]}`}>
                  {statusLabels[job.status]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Priority</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[job.priority]}`}>
                  {job.priority}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Template</dt>
              <dd className="mt-1 text-sm text-gray-900">{job.template?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Assigned To</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Due Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"}
              </dd>
            </div>
            {job.completedAt && (
              <div>
                <dt className="text-sm text-gray-500">Completed</dt>
                <dd className="mt-1 text-sm text-gray-900">{new Date(job.completedAt).toLocaleDateString()}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500">Created By</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {job.createdBy ? `${job.createdBy.firstName} ${job.createdBy.lastName}` : "—"}
              </dd>
            </div>
          </dl>
          {job.description && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <dt className="text-sm text-gray-500 mb-1">Description</dt>
              <dd className="text-sm text-gray-700">{job.description}</dd>
            </div>
          )}
          {job.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <dt className="text-sm text-gray-500 mb-1">Notes</dt>
              <dd className="text-sm text-gray-700">{job.notes}</dd>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Progress</h2>
          {progressPct !== null ? (
            <>
              <div className="text-3xl font-bold text-gray-900 mb-2">{progressPct}%</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{completedSteps} of {job.steps.length} steps complete</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No steps defined</p>
          )}
        </div>
      </div>

      {job.steps.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Workflow Steps</h2>
          </div>
          <JobStepsPanel steps={job.steps} jobId={job.id} />
        </div>
      )}
    </div>
  );
}
