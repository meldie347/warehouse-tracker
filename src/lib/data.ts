import { prisma } from "@/lib/prisma";
import { getLastCompletedWeekRange } from "@/lib/dateFormat";

export type WarehouseBreakdownProduct = { name: string; value: number };
export type WarehouseBreakdownCategory = {
  name: string;
  products: WarehouseBreakdownProduct[];
};

export async function getCategoriesWithProducts() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      products: { orderBy: { name: "asc" } },
    },
  });
}

export async function getLastStockUpdateTime(): Promise<Date | null> {
  const result = await prisma.product.aggregate({ _max: { updatedAt: true } });
  return result._max.updatedAt;
}

export async function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      deactivatedAt: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

/** Admin-managed "Send to shop" destination list. Includes retired shops (callers filter as needed). */
export async function getShops() {
  return prisma.shop.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAuditLog(filters: {
  userId?: string;
  productId?: string;
  shopId?: string;
}) {
  return prisma.auditLog.findMany({
    where: {
      userId: filters.userId,
      productId: filters.productId,
      shopId: filters.shopId,
    },
    include: {
      shop: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** The last completed Monday-Sunday week, used as the report page's default range when no dates are picked. */
export const getWeeklyReportDateRange = getLastCompletedWeekRange;

/**
 * Sums rows sharing the same (category, product) together — e.g. a product sent to the
 * same shop in several separate entries within a date range. Preserves input order and does
 * not filter, so callers that need the full catalog can use this directly instead of the
 * stricter aggregateByProduct below.
 */
export function sumDuplicateProductRows<
  T extends { categoryNameSnapshot: string; productNameSnapshot: string; value: number },
>(rows: T[]): { categoryNameSnapshot: string; productNameSnapshot: string; value: number }[] {
  const byKey = new Map<string, { categoryNameSnapshot: string; productNameSnapshot: string; value: number }>();
  for (const row of rows) {
    const key = `${row.categoryNameSnapshot} ${row.productNameSnapshot}`;
    const existing = byKey.get(key);
    if (existing) existing.value += row.value;
    else byKey.set(key, { categoryNameSnapshot: row.categoryNameSnapshot, productNameSnapshot: row.productNameSnapshot, value: row.value });
  }
  return Array.from(byKey.values());
}

function aggregateByProduct(
  rows: { categoryNameSnapshot: string; productNameSnapshot: string; value: number }[]
): { categoryNameSnapshot: string; productNameSnapshot: string; value: number }[] {
  return sumDuplicateProductRows(rows)
    .filter((row) => row.value > 0)
    .sort(
      (a, b) =>
        a.categoryNameSnapshot.localeCompare(b.categoryNameSnapshot) ||
        a.productNameSnapshot.localeCompare(b.productNameSnapshot)
    );
}

export type ShopSendSummary = {
  shopId: string | null;
  shopName: string;
  rows: { categoryNameSnapshot: string; productNameSnapshot: string; value: number }[];
};

/**
 * Total units sent to each shop within an arbitrary date range (until is exclusive),
 * optionally scoped to one shop. Prefers the *current* shop/product/category name over the
 * snapshot frozen at send time — a rename mid-range shouldn't split one shop's or product's
 * activity across two rows — falling back to the snapshot only once the shop or product has
 * since been deleted.
 */
export async function getSendSummary(since: Date, until: Date, shopId?: string): Promise<ShopSendSummary[]> {
  const entries = await prisma.auditLog.findMany({
    where: {
      action: "SEND",
      createdAt: { gte: since, lt: until },
      ...(shopId ? { shopId } : {}),
    },
    select: {
      quantityDelta: true,
      categoryNameSnapshot: true,
      productNameSnapshot: true,
      shopId: true,
      shopNameSnapshot: true,
      shop: { select: { name: true } },
      product: { select: { name: true, category: { select: { name: true } } } },
    },
  });

  const byShopKey = new Map<
    string,
    { shopId: string | null; shopName: string; rows: { categoryNameSnapshot: string; productNameSnapshot: string; value: number }[] }
  >();
  for (const e of entries) {
    const shopName = e.shop?.name ?? e.shopNameSnapshot ?? "Deleted shop";
    const key = e.shopId ?? `deleted:${shopName}`;
    let group = byShopKey.get(key);
    if (!group) {
      group = { shopId: e.shopId, shopName, rows: [] };
      byShopKey.set(key, group);
    }
    group.rows.push({
      categoryNameSnapshot: e.product?.category.name ?? e.categoryNameSnapshot,
      productNameSnapshot: e.product?.name ?? e.productNameSnapshot,
      value: -e.quantityDelta,
    });
  }

  return Array.from(byShopKey.values())
    .map((group) => ({ ...group, rows: aggregateByProduct(group.rows) }))
    .sort((a, b) => a.shopName.localeCompare(b.shopName));
}

/** Groups flat (category, product, value) rows back into categories, preserving DB order. */
export function groupByCategory(
  rows: { categoryNameSnapshot: string; productNameSnapshot: string; value: number }[]
): WarehouseBreakdownCategory[] {
  const categories: WarehouseBreakdownCategory[] = [];
  const byName = new Map<string, WarehouseBreakdownCategory>();

  for (const row of rows) {
    let category = byName.get(row.categoryNameSnapshot);
    if (!category) {
      category = { name: row.categoryNameSnapshot, products: [] };
      byName.set(row.categoryNameSnapshot, category);
      categories.push(category);
    }
    category.products.push({ name: row.productNameSnapshot, value: row.value });
  }

  return categories;
}
