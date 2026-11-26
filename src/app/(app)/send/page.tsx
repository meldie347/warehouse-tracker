import { getCategoriesWithProducts, getShops } from "@/lib/data";
import BatchSendClient from "@/components/BatchSendClient";

export default async function SendPage() {
  const [categories, shops] = await Promise.all([getCategoriesWithProducts(), getShops()]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
        Send to Shop
      </h1>
      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No categories yet. Head to Products &amp; Categories to add your first category and products.
        </p>
      ) : (
        <BatchSendClient
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            products: c.products.map((p) => ({ id: p.id, name: p.name, stockCount: p.stockCount })),
          }))}
          shops={shops.map((s) => ({
            id: s.id,
            name: s.name,
            retiredAt: s.retiredAt ? s.retiredAt.toISOString() : null,
          }))}
        />
      )}
    </div>
  );
}
