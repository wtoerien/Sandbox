import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();

  const [clientCount, jobCount, templateCount, userCount] = await Promise.all([
    db.client.count({ where: { isActive: true } }),
    db.job.count(),
    db.jobTemplate.count({ where: { isActive: true } }),
    db.user.count({ where: { isActive: true } }),
  ]);

  const recentJobs = await db.job.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: { client: true, assignedTo: true },
  });

  const jobsByStatus = await db.job.groupBy({
    by: ["status"],
    _count: true,
  });

  const statusMap: Record<string, number> = {};
  for (const s of jobsByStatus) {
    statusMap[s.status] = s._count;
  }

  const statusLabels: Record<string, string> = {
    NOT_STARTED: "Not Started",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  const statusColors: Record<string, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    ON_HOLD: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome back, {session?.firstName}
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: "Active Clients", value: clientCount, href: "/clients", color: "blue" },
          { label: "Total Jobs", value: jobCount, href: "/jobs", color: "green" },
          { label: "Job Templates", value: templateCount, href: "/templates", color: "purple" },
          { label: "Staff Members", value: userCount, href: "/users", color: "orange" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Jobs by Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Jobs by Status</h2>
          <div className="space-y-3">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status]}`}>
                  {label}
                </span>
                <span className="text-gray-900 font-medium">{statusMap[status] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Jobs</h2>
            <Link href="/jobs/new" className="text-sm text-blue-600 hover:text-blue-700">
              + New Job
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-sm">No jobs yet. <Link href="/jobs/new" className="text-blue-600 hover:underline">Create your first job.</Link></p>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{job.title}</p>
                    <p className="text-xs text-gray-500">{job.client.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.assignedTo && (
                      <span className="text-xs text-gray-500">
                        {job.assignedTo.firstName}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[job.status]}`}>
                      {statusLabels[job.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
