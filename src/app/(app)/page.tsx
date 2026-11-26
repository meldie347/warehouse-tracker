import { getCategoriesWithProducts, getLastActionByProductId, getShops } from "@/lib/data";
import CategorySection from "@/components/CategorySection";
import TabSwitcher from "@/components/TabSwitcher";

export default async function CatalogPage() {
  const [categories, shops, lastActionByProductId] = await Promise.all([
    getCategoriesWithProducts(),
    getShops(),
    getLastActionByProductId(),
  ]);

  const shopOptions = shops.map((s) => ({
    id: s.id,
    name: s.name,
    retiredAt: s.retiredAt ? s.retiredAt.toISOString() : null,
  }));

  // A product can be undone only while an UNDO entry isn't already its last action.
  const undoableProductIds = Array.from(lastActionByProductId.entries())
    .filter(([, entry]) => entry.action !== "UNDO")
    .map(([productId]) => productId);

  return (
    <div>
      {categories.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No categories yet. Head to Products &amp; Categories to add your first category and products.
        </p>
      ) : (
        <TabSwitcher
          tabs={categories.map((c) => ({ id: c.id, label: c.name.split("\n")[0] }))}
        >
          {categories.map((category) => (
            <CategorySection
              key={category.id}
              categoryName={category.name}
              products={category.products}
              shops={shopOptions}
              undoableProductIds={undoableProductIds}
            />
          ))}
        </TabSwitcher>
      )}
    </div>
  );
}
