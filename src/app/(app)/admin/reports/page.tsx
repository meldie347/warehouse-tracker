import { getSendSummary, getShops, getWeeklyReportDateRange, groupByCategory } from "@/lib/data";
import {
  formatDateDDMMYY,
  formatDateInputValue,
  parseShopLocalDateInput,
  shopLocalStartOfNextDay,
} from "@/lib/dateFormat";
import { AUDIT_LOG_RETENTION_DAYS, getAuditLogRetentionCutoff } from "@/lib/retention";
import { buildTopUpCopyText } from "@/lib/sendCopyText";
import WarehouseBreakdown from "@/components/WarehouseBreakdown";
import CopyButton from "@/components/CopyButton";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; shop?: string }>;
}) {
  const params = await searchParams;
  const shops = await getShops();

  const parsedFrom = params.from ? parseShopLocalDateInput(params.from) : null;
  const parsedTo = params.to ? parseShopLocalDateInput(params.to) : null;

  let since: Date;
  let until: Date; // exclusive
  if (parsedFrom && parsedTo) {
    // Forgiving of the two dates being picked in the "wrong" order.
    const [earlier, later] = parsedFrom <= parsedTo ? [parsedFrom, parsedTo] : [parsedTo, parsedFrom];
    since = earlier;
    until = shopLocalStartOfNextDay(later);
  } else {
    ({ since, until } = getWeeklyReportDateRange());
  }

  const selectedShopId = params.shop || undefined;
  const sendSummary = await getSendSummary(since, until, selectedShopId);
  const totalSent = sendSummary.reduce(
    (sum, group) => sum + group.rows.reduce((s, r) => s + r.value, 0),
    0
  );

  // `until` is exclusive (start of the day after the range) — step back 1ms to land on the
  // actual last included day for display.
  const displayUntil = new Date(until.getTime() - 1);
  const rangeLabel = `${formatDateDDMMYY(since)} – ${formatDateDDMMYY(displayUntil)}`;

  const retentionCutoff = getAuditLogRetentionCutoff();
  const mayBeIncomplete = since < retentionCutoff;

  const todayValue = formatDateInputValue(new Date());
  const todayParams = new URLSearchParams({ from: todayValue, to: todayValue });
  if (selectedShopId) todayParams.set("shop", selectedShopId);
  const todayHref = `?${todayParams.toString()}`;

  const singleShopCategories =
    selectedShopId && sendSummary.length > 0 ? groupByCategory(sendSummary[0]!.rows) : null;

  return (
    <div>
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Report</h1>

      <form method="get" className="mt-3 mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Shop
          <select
            name="shop"
            defaultValue={params.shop ?? ""}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm max-w-[16rem]"
          >
            <option value="">All shops</option>
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
            defaultValue={formatDateInputValue(since)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          To
          <input
            type="date"
            name="to"
            defaultValue={formatDateInputValue(displayUntil)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium"
        >
          View range
        </button>
        <a
          href={todayHref}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-zinc-900"
        >
          Today
        </a>
      </form>

      <p className="text-sm text-zinc-500 mb-2">
        Showing {rangeLabel}. Only products with activity are listed.
      </p>
      {mayBeIncomplete && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
          Data is only kept for {AUDIT_LOG_RETENTION_DAYS} days — results before{" "}
          {formatDateDDMMYY(retentionCutoff)} may be incomplete or missing.
        </p>
      )}

      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-1">Sent to shops</h2>
      <p className="text-xs text-zinc-500 mb-3">{totalSent} units sent in this range</p>

      {sendSummary.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing sent in this range.</p>
      ) : selectedShopId && singleShopCategories ? (
        <div>
          <div className="mb-3 flex justify-end">
            <CopyButton
              text={buildTopUpCopyText(sendSummary[0]!.shopName, rangeLabel, singleShopCategories)}
              label="Copy top-up list"
            />
          </div>
          <WarehouseBreakdown kind="SENT" categories={singleShopCategories} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {sendSummary.map((group) => {
            const shopTotal = group.rows.reduce((sum, r) => sum + r.value, 0);
            const categories = groupByCategory(group.rows);
            return (
              <div key={group.shopId ?? group.shopName}>
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {group.shopName}
                  </h3>
                  <CopyButton
                    text={buildTopUpCopyText(group.shopName, rangeLabel, categories)}
                    label="Copy top-up list"
                  />
                </div>
                <p className="text-xs text-zinc-500 mb-3">{shopTotal} units sent</p>
                <WarehouseBreakdown kind="SENT" categories={categories} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
