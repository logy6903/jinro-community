import Link from "next/link";
import type { SchoolLevel } from "@/lib/domain/types";
import { SCHOOL_LEVEL_LABEL } from "@/lib/domain/labels";

// 중/고 split is a first-class control, not a filter buried in a menu — the
// two tracks have different academic calendars and content.

const LEVELS: SchoolLevel[] = ["middle", "high"];

export function SchoolLevelToggle({ active }: { active: SchoolLevel }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1">
      {LEVELS.map((level) => {
        const selected = level === active;
        return (
          <Link
            key={level}
            href={`/?level=${level}`}
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
              (selected
                ? "bg-brand text-white"
                : "text-muted hover:text-foreground")
            }
          >
            {SCHOOL_LEVEL_LABEL[level]}
          </Link>
        );
      })}
    </div>
  );
}
