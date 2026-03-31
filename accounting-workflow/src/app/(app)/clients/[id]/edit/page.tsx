import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Client</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <ClientForm client={client} />
      </div>
    </div>
  );
}
