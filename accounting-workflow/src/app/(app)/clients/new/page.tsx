import { ClientForm } from "@/components/client-form";

export default function NewClientPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add New Client</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <ClientForm />
      </div>
    </div>
  );
}
