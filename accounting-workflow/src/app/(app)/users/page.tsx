import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import Link from "next/link";

export default async function UsersPage() {
  const session = await getSession();
  const users = await db.user.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: {
      _count: { select: { assignedJobs: true } },
    },
  });

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-800",
    MANAGER: "bg-purple-100 text-purple-800",
    STAFF: "bg-blue-100 text-blue-800",
  };

  const canManage = session?.role === "ADMIN" || session?.role === "MANAGER";

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        {canManage && (
          <Link
            href="/users/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
          >
            + Add User
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Jobs</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              {canManage && <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                  {user.id === session?.id && <div className="text-xs text-gray-400">You</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${roleColors[user.role] ?? "bg-gray-100 text-gray-800"}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user._count.assignedJobs}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <Link href={`/users/${user.id}/edit`} className="text-blue-600 hover:text-blue-700">Edit</Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
