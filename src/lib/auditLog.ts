import type { WarehouseAction, Prisma } from "@/generated/prisma/client";

export async function recordAuditEntry(
  tx: Prisma.TransactionClient,
  entry: {
    action: WarehouseAction;
    userId: string;
    usernameSnapshot: string;
    productId: string | null;
    productNameSnapshot: string;
    categoryNameSnapshot: string;
    quantityDelta: number;
    stockBefore: number;
    stockAfter: number;
    shopId?: string | null;
    shopNameSnapshot?: string | null;
    note?: string | null;
  }
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
