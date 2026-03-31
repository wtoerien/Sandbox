import { UserForm } from "@/components/user-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewUserPage() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) redirect("/users");

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New User</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <UserForm />
      </div>
    </div>
  );
}
