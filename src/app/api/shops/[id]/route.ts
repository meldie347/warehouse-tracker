import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/apiHelpers";
import { updateShopSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminRequest(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { retired, ...rest } = parsed.data;
  const shop = await prisma.shop.update({
    where: { id },
    data: {
      ...rest,
      ...(retired !== undefined ? { retiredAt: retired ? new Date() : null } : {}),
    },
  });

  return NextResponse.json(shop);
}

/**
 * Unlike a Category, a Shop hard-deletes freely even with history against it —
 * every AuditLog row referencing it has ON DELETE SET NULL plus its own
 * shopNameSnapshot, so deleting one never corrupts a past "sent to X" record.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminRequest(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  await prisma.shop.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
