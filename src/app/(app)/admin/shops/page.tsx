import { getShops } from "@/lib/data";
import ManageShopsClient from "@/components/ManageShopsClient";

export default async function AdminShopsPage() {
  const shops = await getShops();

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        Shops
      </h1>
      <ManageShopsClient
        shops={shops.map((s) => ({
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          retiredAt: s.retiredAt ? s.retiredAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
