import ProductRow from "@/components/ProductRow";

type Product = {
  id: string;
  name: string;
  stockCount: number;
};

type Shop = { id: string; name: string; retiredAt: string | null };

export default function CategorySection({
  categoryName,
  products,
  shops,
  undoableProductIds,
}: {
  categoryName: string;
  products: Product[];
  shops: Shop[];
  undoableProductIds: string[];
}) {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 mb-16">
      <h2 className="whitespace-pre-line text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-50 mb-2">
        {categoryName}
      </h2>
      {products.map((product) => (
        <ProductRow
          key={product.id}
          productId={product.id}
          name={product.name}
          stockCount={product.stockCount}
          shops={shops}
          undoable={undoableProductIds.includes(product.id)}
        />
      ))}
    </section>
  );
}
