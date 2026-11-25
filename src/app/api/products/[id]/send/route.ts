import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedRequest } from "@/lib/apiHelpers";
import { sendSchema } from "@/lib/validation";
import { recordAuditEntry } from "@/lib/auditLog";

/** Records stock leaving the warehouse for a shop — always decreases stock, never below 0. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedRequest(request);
  if ("error" in auth) return auth.error;

  const { id: productId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quantity or shop" }, { status: 400 });
  }
  const { quantity, shopId } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });
      if (!product) throw new Error("NOT_FOUND");

      const shop = await tx.shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new Error("SHOP_NOT_FOUND");
      if (shop.retiredAt) throw new Error("SHOP_RETIRED");

      const nextStock = product.stockCount - quantity;
      if (nextStock < 0) throw new Error("INSUFFICIENT_STOCK");

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockCount: nextStock },
      });

      await recordAuditEntry(tx, {
        action: "SEND",
        userId: auth.user.userId,
        usernameSnapshot: auth.user.username,
        productId: product.id,
        productNameSnapshot: product.name,
        categoryNameSnapshot: product.category.name,
        quantityDelta: -quantity,
        stockBefore: product.stockCount,
        stockAfter: updated.stockCount,
        shopId: shop.id,
        shopNameSnapshot: shop.name,
      });

      return { stockCount: updated.stockCount };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "SHOP_NOT_FOUND") {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "SHOP_RETIRED") {
      return NextResponse.json({ error: "This shop has been retired" }, { status: 409 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "Not enough stock" }, { status: 400 });
    }
    throw err;
  }
}
