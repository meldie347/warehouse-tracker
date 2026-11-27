import type { WarehouseBreakdownCategory } from "@/lib/data";

function categoryLines(category: WarehouseBreakdownCategory): string[] {
  const lines = category.name.split("\n");
  category.products.forEach((product) => lines.push(`${product.name}: ${product.value}`));
  return lines;
}

/** Plain-text top-up list for a shop, ready to paste into a message to that shop's staff. */
export function buildTopUpCopyText(
  shopName: string,
  dateLabel: string,
  categories: WarehouseBreakdownCategory[]
): string {
  const lines = [`Top-up for ${shopName} — ${dateLabel}`, ""];
  categories.forEach((category, index) => {
    lines.push(...categoryLines(category));
    if (index < categories.length - 1) lines.push("");
  });
  return lines.join("\n");
}
