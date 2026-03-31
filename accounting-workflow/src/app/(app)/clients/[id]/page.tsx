import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: {
      jobs: {
        include: { assignedTo: true, template: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) notFound();

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

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-700">← Clients</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{client.name}</h1>
          <p className="text-gray-500">{client.code}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/jobs/new?clientId=${client.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
            + New Job
          </Link>
          <Link href={`/clients/${client.id}/edit`} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50">
            Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Details</h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Type</dt>
              <dd className="text-sm font-medium text-gray-900">{client.clientType}</dd>
            </div>
            {client.email && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="text-sm text-gray-900">{client.email}</dd>
              </div>
            )}
            {client.phone && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-sm text-gray-900">{client.phone}</dd>
              </div>
            )}
            {client.taxFileNumber && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">TFN</dt>
                <dd className="text-sm text-gray-900">{client.taxFileNumber}</dd>
              </div>
            )}
            {client.abn && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">ABN</dt>
                <dd className="text-sm text-gray-900">{client.abn}</dd>
              </div>
            )}
            {client.address && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Address</dt>
                <dd className="text-sm text-gray-900">{client.address}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Status</dt>
              <dd>
                <span className={`px-2 py-1 rounded text-xs font-medium ${client.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {client.isActive ? "Active" : "Inactive"}
                </span>
              </dd>
            </div>
          </dl>
          {client.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 font-medium mb-1">Notes</p>
              <p className="text-sm text-gray-700">{client.notes}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Summary</h2>
          <div className="text-3xl font-bold text-gray-900 mb-4">{client.jobs.length}</div>
          <div className="space-y-2">
            {["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"].map((status) => {
              const count = client.jobs.filter((j) => j.status === status).length;
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[status]}`}>{statusLabels[status]}</span>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Jobs</h2>
        </div>
        {client.jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No jobs for this client. <Link href={`/jobs/new?clientId=${client.id}`} className="text-blue-600 hover:underline">Create a job.</Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {client.jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{job.title}</div>
                    {job.financialYear && <div className="text-xs text-gray-500">FY {job.financialYear}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{job.template?.name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {job.assignedTo ? `${job.assignedTo.firstName} ${job.assignedTo.lastName}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"}
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
