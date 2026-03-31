"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(app)/actions";
import type { SessionUser } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/clients", label: "Clients", icon: "👥" },
  { href: "/jobs", label: "Jobs", icon: "📋" },
  { href: "/templates", label: "Job Templates", icon: "📄" },
  { href: "/users", label: "Users", icon: "👤" },
  { href: "/practice", label: "Practice", icon: "🏢" },
];

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">WorkFlow</h1>
        <p className="text-xs text-gray-400 mt-1">Accounting Management</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="text-sm text-gray-300 mb-2">
          {user.firstName} {user.lastName}
          <span className="ml-2 text-xs bg-gray-700 px-1 rounded">{user.role}</span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
