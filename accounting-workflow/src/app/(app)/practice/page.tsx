import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PracticeForm } from "@/components/practice-form";

export default async function PracticePage() {
  const session = await getSession();
  const practice = await db.practice.findFirst();

  const canEdit = session?.role === "ADMIN";

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Practice Settings</h1>
      <div className="bg-white rounded-lg shadow p-6">
        {practice ? (
          <PracticeForm practice={practice} canEdit={canEdit} />
        ) : (
          <p className="text-gray-500">No practice found.</p>
        )}
      </div>
    </div>
  );
}
