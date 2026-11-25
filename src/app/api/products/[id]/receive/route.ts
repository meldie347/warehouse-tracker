import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedRequest } from "@/lib/apiHelpers";
import { receiveSchema } from "@/lib/validation";
import { recordAuditEntry } from "@/lib/auditLog";

/** Records stock arriving into the warehouse from a supplier — always increases stock. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedRequest(request);
  if ("error" in auth) return auth.error;

  const { id: productId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = receiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }
  const { quantity, note } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });
      if (!product) throw new Error("NOT_FOUND");

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockCount: { increment: quantity } },
      });

      await recordAuditEntry(tx, {
        action: "RECEIVE",
        userId: auth.user.userId,
        usernameSnapshot: auth.user.username,
        productId: product.id,
        productNameSnapshot: product.name,
        categoryNameSnapshot: product.category.name,
        quantityDelta: quantity,
        stockBefore: product.stockCount,
        stockAfter: updated.stockCount,
        note: note ?? null,
      });

      return { stockCount: updated.stockCount };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    throw err;
  }
}
