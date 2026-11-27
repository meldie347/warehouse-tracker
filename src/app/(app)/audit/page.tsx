import { getAuditLog, getSendSummary, getShops, groupByCategory } from "@/lib/data";
import {
  formatDateDDMMYY,
  formatDateInputValue,
  formatTime12,
  parseShopLocalDateInput,
  shopLocalStartOfNextDay,
} from "@/lib/dateFormat";
import { AUDIT_LOG_RETENTION_DAYS } from "@/lib/retention";
import { buildTopUpCopyText } from "@/lib/sendCopyText";
import CopyButton from "@/components/CopyButton";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const shops = await getShops();

  const parsedFrom = params.from ? parseShopLocalDateInput(params.from) : null;
  const parsedTo = params.to ? parseShopLocalDateInput(params.to) : null;

  let since: Date | undefined;
  let until: Date | undefined; // exclusive
  if (parsedFrom && parsedTo) {
    // Forgiving of the two dates being picked in the "wrong" order.
    const [earlier, later] = parsedFrom <= parsedTo ? [parsedFrom, parsedTo] : [parsedTo, parsedFrom];
    since = earlier;
    until = shopLocalStartOfNextDay(later);
  }

  const selectedShopId = params.shop || undefined;
  const entries = await getAuditLog({ shopId: selectedShopId, since, until });

  const todayValue = formatDateInputValue(new Date());
  const todayParams = new URLSearchParams({ from: todayValue, to: todayValue });
  if (selectedShopId) todayParams.set("shop", selectedShopId);
  const todayHref = `?${todayParams.toString()}`;

  // Only meaningful once both a shop and a date range are picked — a top-up list is
  // inherently "this shop, this period", same as the Report page's version of it.
  let topUpText: string | null = null;
  if (selectedShopId && since && until) {
    const [summary] = await getSendSummary(since, until, selectedShopId);
    if (summary) {
      const displayUntil = new Date(until.getTime() - 1);
      const rangeLabel = `${formatDateDDMMYY(since)} – ${formatDateDDMMYY(displayUntil)}`;
      topUpText = buildTopUpCopyText(summary.shopName, rangeLabel, groupByCategory(summary.rows));
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Activity log</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Last {AUDIT_LOG_RETENTION_DAYS} days of stock changes. Older entries are automatically removed.
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Shop
          <select
            name="shop"
            defaultValue={params.shop ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm max-w-[16rem]"
          >
            <option value="">All entries</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          From
          <input
            type="date"
            name="from"
            defaultValue={params.from ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          To
          <input
            type="date"
            name="to"
            defaultValue={params.to ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium"
        >
          Filter
        </button>
        <a
          href={todayHref}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-zinc-900"
        >
          Today
        </a>
      </form>

      {topUpText && (
        <div className="mb-4 flex justify-end">
          <CopyButton text={topUpText} label="Copy top-up list" />
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity {selectedShopId || since ? "matching this filter" : "yet"}.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => {
            const shopName = entry.shop?.name ?? entry.shopNameSnapshot;
            return (
              <div
                key={entry.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {entry.categoryNameSnapshot} &middot; {entry.productNameSnapshot}
                  </span>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {formatDateDDMMYY(entry.createdAt)} {formatTime12(entry.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {entry.action} by {entry.usernameSnapshot} ·{" "}
                  {entry.stockBefore} &rarr;{" "}
                  {entry.stockAfter}
                  {shopName ? ` · to ${shopName}` : ""}
                  {entry.note ? ` · ${entry.note}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
