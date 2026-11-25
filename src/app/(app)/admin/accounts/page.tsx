import { getAllUsers } from "@/lib/data";
import AdminAccountsClient from "@/components/AdminAccountsClient";

export default async function AdminAccountsPage() {
  const users = await getAllUsers();

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        Accounts
      </h1>
      <AdminAccountsClient
        users={users.map((u) => ({
          id: u.id,
          username: u.username,
          role: u.role,
          deactivatedAt: u.deactivatedAt ? u.deactivatedAt.toISOString() : null,
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
