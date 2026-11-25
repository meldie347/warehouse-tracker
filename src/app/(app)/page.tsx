import { getCategoriesWithProducts, getShops } from "@/lib/data";
import CategorySection from "@/components/CategorySection";
import TabSwitcher from "@/components/TabSwitcher";

export default async function CatalogPage() {
  const [categories, shops] = await Promise.all([getCategoriesWithProducts(), getShops()]);

  const shopOptions = shops.map((s) => ({
    id: s.id,
    name: s.name,
    retiredAt: s.retiredAt ? s.retiredAt.toISOString() : null,
  }));

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
            />
          ))}
        </TabSwitcher>
      )}
    </div>
  );
}
