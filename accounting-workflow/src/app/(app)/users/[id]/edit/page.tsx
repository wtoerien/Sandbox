import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { UserForm } from "@/components/user-form";
import { getSession } from "@/lib/auth";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) redirect("/users");

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit User</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <UserForm user={user} />
      </div>
    </div>
  );
}
