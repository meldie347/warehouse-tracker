export type SendCopyCategory = {
  name: string;
  products: { name: string; quantity: number }[];
};

function categoryLines(category: SendCopyCategory): string[] {
  const lines = category.name.split("\n");
  category.products.forEach((product) => lines.push(`${product.name}: ${product.quantity}`));
  return lines;
}

/** Plain-text top-up list for a batch send, ready to paste into a message to a shop's staff. */
export function buildTopUpCopyText(
  shopName: string,
  dateLabel: string,
  categories: SendCopyCategory[]
): string {
  const lines = [`Top-up for ${shopName} — ${dateLabel}`, ""];
  categories.forEach((category, index) => {
    lines.push(...categoryLines(category));
    if (index < categories.length - 1) lines.push("");
  });
  return lines.join("\n");
}
