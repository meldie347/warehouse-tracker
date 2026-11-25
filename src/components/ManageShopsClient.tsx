"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchWithTimeout, describeFetchError } from "@/lib/fetchWithTimeout";

type Shop = {
  id: string;
  name: string;
  sortOrder: number;
  retiredAt: string | null;
};

export default function ManageShopsClient({ shops }: { shops: Shop[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newShopName, setNewShopName] = useState("");

  function run(
    action: () => Promise<Response>,
    options?: { successMessage: string; onSuccess?: () => void }
  ) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await action();
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Something went wrong");
          return;
        }
        options?.onSuccess?.();
        if (options) setSuccess(options.successMessage);
        router.refresh();
      } catch (err) {
        setError(describeFetchError(err));
      }
    });
  }

  function addShop() {
    const name = newShopName.trim();
    if (!name) return;
    run(
      () =>
        fetchWithTimeout("/api/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      {
        successMessage: `Shop "${name}" added`,
        onSuccess: () => setNewShopName(""),
      }
    );
  }

  function renameShop(id: string, name: string) {
    if (!name.trim()) return;
    run(
      () =>
        fetchWithTimeout(`/api/shops/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        }),
      { successMessage: "Shop renamed" }
    );
  }

  function retire(id: string) {
    run(
      () =>
        fetchWithTimeout(`/api/shops/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retired: true }),
        }),
      { successMessage: "Shop retired" }
    );
  }

  function unretire(id: string) {
    run(
      () =>
        fetchWithTimeout(`/api/shops/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ retired: false }),
        }),
      { successMessage: "Shop unretired" }
    );
  }

  function deleteShop(id: string, name: string) {
    if (
      !confirm(
        `Permanently delete "${name}"? This can't be undone. Past "sent to ${name}" entries stay on record, just no longer linked to a live shop.`
      )
    ) {
      return;
    }
    run(() => fetchWithTimeout(`/api/shops/${id}`, { method: "DELETE" }), {
      successMessage: `Shop "${name}" deleted`,
    });
  }

  return (
    <div>
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Add shop</h2>
        <div className="flex gap-2">
          <input
            placeholder="Shop name"
            value={newShopName}
            onChange={(e) => setNewShopName(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          />
          <button
            onClick={addShop}
            disabled={isPending}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mb-4 text-sm text-green-600 dark:text-green-400">{success}</p>}

      {shops.map((shop) => (
        <section
          key={shop.id}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 mb-3"
        >
          <input
            defaultValue={shop.name}
            onBlur={(e) => {
              if (e.target.value !== shop.name) renameShop(shop.id, e.target.value);
            }}
            className="w-full rounded-md border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 bg-transparent px-2 py-1 text-sm font-medium"
          />
          <p className="text-xs text-zinc-500 px-2">{shop.retiredAt ? "Retired" : "Active"}</p>

          <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 px-2 border-t border-zinc-100 dark:border-zinc-900">
            {shop.retiredAt ? (
              <>
                <button
                  onClick={() => unretire(shop.id)}
                  disabled={isPending}
                  className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline"
                >
                  Unretire
                </button>
                <button
                  onClick={() => deleteShop(shop.id, shop.name)}
                  disabled={isPending}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={() => retire(shop.id)}
                disabled={isPending}
                className="text-xs text-red-500 hover:underline"
              >
                Retire
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
