"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchWithTimeout, describeFetchError } from "@/lib/fetchWithTimeout";
import { notifyStockUpdated } from "@/lib/updateSignal";
import { ADJUST_DEDUCTION_REASONS, ADJUST_INCREASE_REASONS } from "@/lib/adjustReasons";
import NumberStepper from "@/components/NumberStepper";

const LOW_STOCK_THRESHOLD = 3; // easy to adjust; low-stock = 0 < stockCount <= this

type Shop = { id: string; name: string; retiredAt: string | null };

export default function ProductRow({
  productId,
  name,
  stockCount,
  shops,
  undoable,
}: {
  productId: string;
  name: string;
  stockCount: number;
  shops: Shop[];
  undoable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState("1");
  const [receiveNote, setReceiveNote] = useState("");

  const [sendOpen, setSendOpen] = useState(false);
  const [sendQty, setSendQty] = useState("1");
  const [sendShopId, setSendShopId] = useState("");

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustValue, setAdjustValue] = useState(String(stockCount));
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustOtherText, setAdjustOtherText] = useState("");

  const [error, setError] = useState<string | null>(null);

  const soldOut = stockCount === 0;
  const lowStock = stockCount > 0 && stockCount <= LOW_STOCK_THRESHOLD;
  const rowBgClass = soldOut
    ? "bg-red-50 dark:bg-red-950/40"
    : lowStock
      ? "bg-amber-50 dark:bg-amber-950/40"
      : "bg-green-50 dark:bg-green-950/40";
  const stockColorClass = soldOut
    ? "text-red-800 dark:text-red-300"
    : lowStock
      ? "text-amber-800 dark:text-amber-300"
      : "text-green-800 dark:text-green-300";

  const activeShops = shops.filter((s) => !s.retiredAt);

  function handleReceiveSave() {
    const quantity = Number(receiveQty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Enter a positive whole number");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetchWithTimeout(`/api/products/${productId}/receive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity,
            ...(receiveNote.trim() ? { note: receiveNote.trim() } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to record received stock");
          return;
        }
        setReceiveOpen(false);
        setReceiveQty("1");
        setReceiveNote("");
        notifyStockUpdated();
        router.refresh();
      } catch (err) {
        setError(describeFetchError(err));
      }
    });
  }

  function handleSendSave() {
    const quantity = Number(sendQty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Enter a positive whole number");
      return;
    }
    if (!sendShopId) {
      setError("Select a shop");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetchWithTimeout(`/api/products/${productId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity, shopId: sendShopId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to record sent stock");
          return;
        }
        setSendOpen(false);
        setSendQty("1");
        setSendShopId("");
        notifyStockUpdated();
        router.refresh();
      } catch (err) {
        setError(describeFetchError(err));
      }
    });
  }

  function handleUndo() {
    if (!confirm("Undo the last change to this product?")) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetchWithTimeout(`/api/products/${productId}/undo-last-change`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to undo");
          return;
        }
        notifyStockUpdated();
        router.refresh();
      } catch (err) {
        setError(describeFetchError(err));
      }
    });
  }

  function handleAdjustSave() {
    const value = Number(adjustValue);
    if (!Number.isInteger(value) || value < 0) {
      setError("Enter a whole number, 0 or more");
      return;
    }
    const isChange = value !== stockCount;
    if (isChange && !adjustReason) {
      setError("Select a reason for this change");
      return;
    }
    if (isChange && adjustReason === "Other" && !adjustOtherText.trim()) {
      setError("Describe the reason");
      return;
    }
    const reason = adjustReason === "Other" ? adjustOtherText.trim() : adjustReason;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetchWithTimeout(`/api/products/${productId}/adjust`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "set",
            value,
            ...(isChange ? { reason } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to adjust stock");
          return;
        }
        setAdjustOpen(false);
        setAdjustReason("");
        setAdjustOtherText("");
        notifyStockUpdated();
        router.refresh();
      } catch (err) {
        setError(describeFetchError(err));
      }
    });
  }

  return (
    <div className={`rounded-lg px-3 py-3 mb-1.5 last:mb-0 ${rowBgClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{name}</p>
          <p className="text-xs text-zinc-500">
            Stock: <span className={`font-semibold ${stockColorClass}`}>{stockCount}</span>
          </p>
        </div>

        {soldOut && (
          <span className="rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 px-2.5 py-1 text-xs font-semibold shrink-0">
            Out of stock
          </span>
        )}
      </div>

      {undoable && (
        <div className="mt-1">
          <button
            onClick={handleUndo}
            disabled={isPending}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Undo last change
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {!receiveOpen ? (
          <button
            onClick={() => setReceiveOpen(true)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Receive stock
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500">Qty</span>
            <NumberStepper value={receiveQty} onChange={setReceiveQty} min={1} />
            <input
              type="text"
              value={receiveNote}
              onChange={(e) => setReceiveNote(e.target.value)}
              placeholder="Note (optional)"
              maxLength={200}
              className="w-36 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-xs"
            />
            <button
              onClick={handleReceiveSave}
              disabled={isPending}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setReceiveOpen(false);
                setReceiveQty("1");
                setReceiveNote("");
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {!sendOpen ? (
          <button
            onClick={() => setSendOpen(true)}
            disabled={soldOut}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
          >
            Send to shop
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500">Qty</span>
            <NumberStepper value={sendQty} onChange={setSendQty} min={1} />
            <select
              value={sendShopId}
              onChange={(e) => setSendShopId(e.target.value)}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-xs"
            >
              <option value="">Select a shop&hellip;</option>
              {activeShops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleSendSave}
              disabled={isPending}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setSendOpen(false);
                setSendQty("1");
                setSendShopId("");
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mt-1.5">
        {!adjustOpen ? (
          <button
            onClick={() => {
              setAdjustValue(String(stockCount));
              setAdjustOpen(true);
            }}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Adjust stock (correction)
          </button>
        ) : (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">Set stock to</span>
              <NumberStepper value={adjustValue} onChange={setAdjustValue} min={0} />
              <button
                onClick={handleAdjustSave}
                disabled={isPending}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setAdjustOpen(false);
                  setAdjustReason("");
                  setAdjustOtherText("");
                }}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Cancel
              </button>
            </div>
            {adjustValue !== "" && Number(adjustValue) !== stockCount && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-500">Reason</span>
                  <select
                    value={adjustReason}
                    onChange={(e) => {
                      setAdjustReason(e.target.value);
                      if (e.target.value !== "Other") setAdjustOtherText("");
                    }}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-xs"
                  >
                    <option value="">Select a reason&hellip;</option>
                    {(Number(adjustValue) > stockCount
                      ? ADJUST_INCREASE_REASONS
                      : ADJUST_DEDUCTION_REASONS
                    ).map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                {adjustReason === "Other" && (
                  <input
                    type="text"
                    value={adjustOtherText}
                    onChange={(e) => setAdjustOtherText(e.target.value)}
                    placeholder="Describe the reason"
                    maxLength={200}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-xs"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
