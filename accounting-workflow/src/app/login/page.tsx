import { LoginForm } from "./login-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-md">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 text-center">WorkFlow</h1>
          <p className="mt-2 text-center text-sm text-gray-600">Accounting Practice Management</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
