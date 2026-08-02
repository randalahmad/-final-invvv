import Link from "next/link";

import { KANBAN_COLUMNS, type KanbanCard } from "@/modules/ideas/kanban";

/**
 * Read-only persisted governance board. Cards come from scope-filtered Idea
 * rows (no mock data). Drag-and-drop is deliberately NOT enabled: status
 * changes must go through the validated server-side transitions on the idea
 * details page, so the board cannot produce an arbitrary/invalid transition.
 */
export function IdeasKanban({ columns }: { columns: Record<string, KanbanCard[]> }) {
  const total = Object.values(columns).reduce((n, c) => n + c.length, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center dark:border-border-dark">
        <p className="text-sm text-muted">لا توجد أفكار في مسار الحوكمة ضمن نطاقك بعد.</p>
        <Link href="/governance/ideas/new" className="mt-2 inline-block text-[12.5px] font-semibold text-primary hover:underline">
          إنشاء فكرة جديدة
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1000px] grid-cols-7 gap-3">
        {KANBAN_COLUMNS.map((col) => {
          const cards = columns[col.status] ?? [];
          return (
            <div key={col.status} className="rounded-2xl bg-slate-100/70 p-2.5 dark:bg-white/5">
              <div className="px-1.5 pb-2 pt-1 text-[12px] text-muted">
                {col.label} <span className="text-[11px]">({cards.length})</span>
              </div>
              {cards.length === 0 ? (
                <p className="px-1.5 py-2 text-[11px] text-muted">لا توجد بطاقات</p>
              ) : (
                cards.map((card) => (
                  <Link
                    key={card.id}
                    href={`/governance/ideas/${card.id}`}
                    className="mb-2 block rounded-xl border border-border bg-surface p-3 transition-shadow hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark"
                  >
                    <div className="mb-1 line-clamp-2 text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
                      {card.titleAr}
                    </div>
                    <div className="text-[10.5px] text-muted">{card.departmentName ?? "—"}</div>
                    <div className="mt-1 text-[10.5px] text-muted">{card.authorName ?? "—"}</div>
                  </Link>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
