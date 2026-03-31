import { db } from "@/lib/db";
import Link from "next/link";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>;
}) {
  const { status, priority } = await searchParams;

  const jobs = await db.job.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: { client: true, assignedTo: true, template: true, steps: true },
  });

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

  const statuses = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <Link
          href="/jobs/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + New Job
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Link
          href="/jobs"
          className={`px-3 py-1.5 rounded text-sm ${!status && !priority ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
        >
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/jobs?status=${s}`}
            className={`px-3 py-1.5 rounded text-sm ${status === s ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            {statusLabels[s]}
          </Link>
        ))}
        <span className="border-l border-gray-200 mx-1" />
        {priorities.map((p) => (
          <Link
            key={p}
            href={`/jobs?priority=${p}`}
            className={`px-3 py-1.5 rounded text-sm ${priority === p ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            {p}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No jobs found. <Link href="/jobs/new" className="text-blue-600 hover:underline">Create a job.</Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => {
                const completedSteps = job.steps.filter((s) => s.status === "COMPLETED").length;
                const progressPct = job.steps.length > 0 ? Math.round((completedSteps / job.steps.length) * 100) : null;
                const isOverdue = job.dueDate && new Date(job.dueDate) < new Date() && job.status !== "COMPLETED" && job.status !== "CANCELLED";

                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{job.title}</div>
                      {job.financialYear && <div className="text-xs text-gray-500">FY {job.financialYear}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <Link href={`/clients/${job.client.id}`} className="hover:text-blue-600">
                        {job.client.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{job.template?.name ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : "—"}
                    </td>
                    <td className={`px-6 py-4 text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"}
                      {isOverdue && <div className="text-xs">Overdue</div>}
                    </td>
                    <td className="px-6 py-4">
                      {progressPct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-16">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{progressPct}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[job.priority]}`}>
                        {job.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[job.status]}`}>
                        {statusLabels[job.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:text-blue-700">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
