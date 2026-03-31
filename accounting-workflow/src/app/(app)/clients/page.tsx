import { db } from "@/lib/db";
import Link from "next/link";

export default async function ClientsPage() {
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { jobs: true } } },
  });

  const typeColors: Record<string, string> = {
    INDIVIDUAL: "bg-blue-100 text-blue-800",
    COMPANY: "bg-purple-100 text-purple-800",
    TRUST: "bg-green-100 text-green-800",
    PARTNERSHIP: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link
          href="/clients/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          + Add Client
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {clients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No clients yet. <Link href="/clients/new" className="text-blue-600 hover:underline">Add your first client.</Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{client.name}</div>
                    {client.abn && <div className="text-xs text-gray-500">ABN: {client.abn}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${typeColors[client.clientType] ?? "bg-gray-100 text-gray-800"}`}>
                      {client.clientType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{client.email}</div>
                    <div>{client.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client._count.jobs}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${client.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {client.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/clients/${client.id}`} className="text-blue-600 hover:text-blue-700 mr-3">View</Link>
                    <Link href={`/clients/${client.id}/edit`} className="text-gray-600 hover:text-gray-700">Edit</Link>
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
