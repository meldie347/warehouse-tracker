import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/apiHelpers";
import { createShopSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const auth = await requireAdminRequest(request);
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = createShopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shop name" }, { status: 400 });
  }

  const max = await prisma.shop.aggregate({ _max: { sortOrder: true } });
  const shop = await prisma.shop.create({
    data: {
      name: parsed.data.name,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json(shop, { status: 201 });
}
