import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedRequest } from "@/lib/apiHelpers";
import { sendBatchSchema } from "@/lib/validation";
import { recordAuditEntry } from "@/lib/auditLog";

/**
 * Sends several products to one shop in a single request — the common case of restocking
 * a shop with a whole list of items, instead of repeating the single-item Send action once
 * per product. All-or-nothing: if any item doesn't have enough stock, nothing in the batch
 * is applied, so the warehouse's counts never end up half-sent.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedRequest(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = sendBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { shopId, items } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shop = await tx.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new Error("SHOP_NOT_FOUND");
      if (shop.retiredAt) throw new Error("SHOP_RETIRED");

      const sent: { productId: string; productName: string; quantity: number; stockCount: number }[] = [];

      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { category: true },
        });
        if (!product) throw new Error("PRODUCT_NOT_FOUND");

        const nextStock = product.stockCount - item.quantity;
        if (nextStock < 0) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { stockCount: nextStock },
        });

        await recordAuditEntry(tx, {
          action: "SEND",
          userId: auth.user.userId,
          usernameSnapshot: auth.user.username,
          productId: product.id,
          productNameSnapshot: product.name,
          categoryNameSnapshot: product.category.name,
          quantityDelta: -item.quantity,
          stockBefore: product.stockCount,
          stockAfter: updated.stockCount,
          shopId: shop.id,
          shopNameSnapshot: shop.name,
        });

        sent.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          stockCount: updated.stockCount,
        });
      }

      return { shopName: shop.name, sent };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "SHOP_NOT_FOUND") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "SHOP_RETIRED") {
      return NextResponse.json({ error: "This shop has been retired" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "A selected product no longer exists" }, { status: 404 });
    }
    if (err instanceof Error && err.message.startsWith("INSUFFICIENT_STOCK:")) {
      const productName = err.message.slice("INSUFFICIENT_STOCK:".length);
      return NextResponse.json(
        { error: `Not enough stock for "${productName}" — nothing in this batch was sent` },
        { status: 400 }
      );
    }
    throw err;
  }
}
