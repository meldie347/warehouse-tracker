"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchWithTimeout, describeFetchError } from "@/lib/fetchWithTimeout";
import { notifyStockUpdated } from "@/lib/updateSignal";
import { formatDateDDMMYY, formatTime12 } from "@/lib/dateFormat";
import { buildTopUpCopyText } from "@/lib/sendCopyText";
import type { WarehouseBreakdownCategory } from "@/lib/data";
import TabSwitcher from "@/components/TabSwitcher";
import CopyButton from "@/components/CopyButton";
import WarehouseBreakdown from "@/components/WarehouseBreakdown";
import NumberStepper from "@/components/NumberStepper";

type Product = { id: string; name: string; stockCount: number };
type Category = { id: string; name: string; products: Product[] };
type Shop = { id: string; name: string; retiredAt: string | null };

export default function BatchSendClient({
  categories,
  shops,
}: {
  categories: Category[];
  shops: Shop[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shopId, setShopId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topUps, setTopUps] = useState<{ id: string; text: string }[]>([]);
  const [history, setHistory] = useState<{ shopName: string; categories: WarehouseBreakdownCategory[] } | null>(
    null
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  const activeShops = shops.filter((s) => !s.retiredAt);
  const shopName = activeShops.find((s) => s.id === shopId)?.name ?? "";

  async function loadHistory(id: string) {
    try {
      const res = await fetchWithTimeout(`/api/shops/${id}/send-history`);
      const data = await res.json();
      setHistory(data);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  const stagedItems = Object.entries(quantities)
    .map(([productId, value]) => ({ productId, quantity: Number(value) }))
    .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);

  function handleShopChange(newShopId: string) {
    setShopId(newShopId);
    // Staged quantities are for one specific shop — switching shops mid-build would
    // otherwise silently carry a list meant for the old shop over to the new one.
    // topUps is left alone: it's a running record of everything sent this visit,
    // so earlier shops' lists are still there to copy later.
    setQuantities({});
    setError(null);
    setSuccess(null);
    setHistory(null);
    // Scoped to whichever shop was just picked — switching shops switches whose
    // history is shown, same as the dropdown scopes everything else on this page.
    if (newShopId) {
      setHistoryLoading(true);
      loadHistory(newShopId);
    }
  }

  function handleQuantityChange(productId: string, value: string) {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  }

  function handleSend() {
    if (!shopId) {
      setError("Select a shop");
      return;
    }
    if (stagedItems.length === 0) {
      setError("Enter a quantity for at least one product");
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await fetchWithTimeout("/api/products/send-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId, items: stagedItems }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to send");
          return;
        }
        setQuantities({});
        setSuccess(`Sent ${data.sent.length} item${data.sent.length === 1 ? "" : "s"} to ${data.shopName}.`);

        const sentByProductId = new Map<string, number>(
          data.sent.map((item: { productId: string; quantity: number }) => [item.productId, item.quantity])
        );
        const sentCategories = categories
          .map((category) => ({
            name: category.name,
            products: category.products
              .filter((product) => sentByProductId.has(product.id))
              .map((product) => ({ name: product.name, value: sentByProductId.get(product.id)! })),
          }))
          .filter((category) => category.products.length > 0);
        const now = new Date();
        const dateLabel = `${formatDateDDMMYY(now)}, ${formatTime12(now)}`;
        const text = buildTopUpCopyText(data.shopName, dateLabel, sentCategories);
        setTopUps((prev) => [{ id: `${now.getTime()}-${Math.random()}`, text }, ...prev]);
        setHistoryLoading(true);
        loadHistory(shopId);

        notifyStockUpdated();
        router.refresh();
      } catch (err) {
        setError(describeFetchError(err));
      }
    });
  }

  return (
    <div className="pb-20">
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 mb-4">
        <label className="block text-xs text-zinc-500 mb-1">Shop</label>
        <select
          value={shopId}
          onChange={(e) => handleShopChange(e.target.value)}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Select a shop&hellip;</option>
          {activeShops.map((shop) => (
            <option key={shop.id} value={shop.id}>
              {shop.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-400 mt-1">
          Enter a quantity for every product you want to send, across any category, then
          send them all to this shop in one go.
        </p>
      </section>

      {shopId && (
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Sent to {shopName} today
            </h2>
            {history && history.categories.length > 0 && (
              <CopyButton
                text={buildTopUpCopyText(history.shopName, formatDateDDMMYY(new Date()), history.categories)}
                label="Copy top-up list"
              />
            )}
          </div>
          {historyLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : history && history.categories.length > 0 ? (
            <WarehouseBreakdown kind="SENT" categories={history.categories} />
          ) : (
            <p className="text-sm text-zinc-500">Nothing sent to this shop yet today.</p>
          )}
        </section>
      )}

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mb-2 text-sm text-green-600 dark:text-green-400">{success}</p>}

      {topUps.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {topUps.map((entry) => (
            <section
              key={entry.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4"
            >
              <div className="mb-2 flex justify-end">
                <CopyButton text={entry.text} />
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-900 dark:text-zinc-50">
                {entry.text}
              </pre>
            </section>
          ))}
        </div>
      )}

      <TabSwitcher tabs={categories.map((c) => ({ id: c.id, label: c.name.split("\n")[0] }))}>
        {categories.map((category) => (
          <section
            key={category.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 mb-16"
          >
            <h2 className="whitespace-pre-line text-sm font-bold uppercase tracking-wide text-zinc-900 dark:text-zinc-50 mb-2">
              {category.name}
            </h2>
            {category.products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 py-2 border-t border-zinc-100 dark:border-zinc-900 first:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-900 dark:text-zinc-50">{product.name}</p>
                  <p className="text-xs text-zinc-500">Stock: {product.stockCount}</p>
                </div>
                <NumberStepper
                  value={quantities[product.id] ?? ""}
                  onChange={(value) => handleQuantityChange(product.id, value)}
                  min={0}
                  className="shrink-0"
                />
              </div>
            ))}
          </section>
        ))}
      </TabSwitcher>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            {stagedItems.length} item{stagedItems.length === 1 ? "" : "s"} selected
            {shopName ? ` for ${shopName}` : ""}
          </p>
          <button
            onClick={handleSend}
            disabled={isPending || !shopId || stagedItems.length === 0}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
