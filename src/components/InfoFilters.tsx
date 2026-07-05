"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FACETS } from "@/lib/info/facets";

// Six dropdowns, one per facet axis. Selecting a value writes it to the URL
// searchParams so the server page can filter; "전체" clears that axis. The URL
// stays shareable/bookmarkable and the back button works.

export function InfoFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setFacet(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const activeCount = FACETS.filter((f) => params.get(f.key)).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {FACETS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">{f.label}</span>
            <select
              value={params.get(f.key) ?? ""}
              onChange={(e) => setFacet(f.key, e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              <option value="">전체</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="self-start text-xs font-medium text-brand hover:opacity-80"
        >
          필터 초기화 ({activeCount})
        </button>
      )}
    </div>
  );
}
