import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedRequest } from "@/lib/apiHelpers";
import { recordAuditEntry } from "@/lib/auditLog";

/**
 * Reverses the single most recent Receive, Send, or Adjust on a product, but only while
 * it's still the last thing that happened to it (undoing an undo isn't supported). Unlike
 * the shop app, every action here writes exactly one audit entry and has no side table to
 * unwind (no shift, no sales revenue), so reversing is always just "set stockCount back to
 * this entry's stockBefore" regardless of which action it was.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedRequest(request);
  if ("error" in auth) return auth.error;

  const { id: productId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });
      if (!product) throw new Error("NOT_FOUND");

      const lastEntry = await tx.auditLog.findFirst({
        where: { productId },
        orderBy: { createdAt: "desc" },
      });
      if (!lastEntry) throw new Error("NOTHING_TO_UNDO");
      if (lastEntry.action !== "RECEIVE" && lastEntry.action !== "SEND" && lastEntry.action !== "ADJUST") {
        throw new Error("NOTHING_TO_UNDO");
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockCount: lastEntry.stockBefore },
      });

      await tx.auditLog.delete({ where: { id: lastEntry.id } });

      const actionLabel =
        lastEntry.action === "RECEIVE" ? "Receive" : lastEntry.action === "SEND" ? "Send" : "Adjust";
      await recordAuditEntry(tx, {
        action: "UNDO",
        userId: auth.user.userId,
        usernameSnapshot: auth.user.username,
        productId: product.id,
        productNameSnapshot: product.name,
        categoryNameSnapshot: product.category.name,
        quantityDelta: updated.stockCount - product.stockCount,
        stockBefore: product.stockCount,
        stockAfter: updated.stockCount,
        note: `Undid ${actionLabel}${lastEntry.note ? ` (was: ${lastEntry.note})` : ""}`,
      });

      return { stockCount: updated.stockCount };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "NOTHING_TO_UNDO") {
      return NextResponse.json(
        { error: "Nothing to undo — use Adjust stock instead" },
        { status: 409 }
      );
    }
    throw err;
  }
}
