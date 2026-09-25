"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ProjectCategory } from "@/content/types";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tones";

export interface FilterOption {
  slug: ProjectCategory;
  label: string;
  tone: Tone;
}

type Filter = ProjectCategory | "all";

interface FilterState {
  filter: Filter;
  /** Changes the filter; `smooth` animates the gallery reflow where the browser supports view transitions. */
  select: (next: Filter, smooth?: boolean) => void;
}

const FilterContext = createContext<FilterState | null>(null);

export function useProjectFilter() {
  const state = useContext(FilterContext);
  if (!state) throw new Error("useProjectFilter must be used inside <ProjectFilterProvider>");
  return state;
}

/** Holds the category filter shared by the hero's quick filter and the gallery. */
export function ProjectFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<Filter>("all");

  const select = useCallback((next: Filter, smooth = true) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!smooth || reduce || typeof document.startViewTransition !== "function") {
      setFilter(next);
      return;
    }
    document.documentElement.setAttribute("data-vt", "filter");
    const transition = document.startViewTransition(() => flushSync(() => setFilter(next)));
    transition.finished.finally(() => document.documentElement.removeAttribute("data-vt"));
  }, []);

  const value = useMemo(() => ({ filter, select }), [filter, select]);
  return <FilterContext value={value}>{children}</FilterContext>;
}

/**
 * Category chips (toggle buttons). The gallery's bar filters in place; the
 * hero's quick filter also takes the visitor to the gallery. Hidden without
 * JavaScript, when every project is shown.
 */
export function FilterChips({
  options,
  allLabel,
  label,
  scrollTo,
  size = "md",
  className,
}: {
  options: FilterOption[];
  allLabel: string;
  label: string;
  /** Element id to scroll to after choosing (the hero's quick filter). */
  scrollTo?: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const { filter, select } = useProjectFilter();

  const choose = (next: Filter) => {
    if (scrollTo) {
      select(next, false);
      const target = document.getElementById(scrollTo);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    } else {
      select(next);
    }
  };

  return (
    <div role="group" aria-label={label} className={cn("js-only flex gap-2", size === "sm" && "chips-sm", className)}>
      <Chip pressed={filter === "all"} onClick={() => choose("all")}>
        {allLabel}
      </Chip>
      {options.map((option) => (
        <Chip key={option.slug} pressed={filter === option.slug} onClick={() => choose(option.slug)} tone={option.tone}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ pressed, onClick, tone, children }: { pressed: boolean; onClick: () => void; tone?: Tone; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="filter-chip" data-tone={tone}>
      {tone && <span aria-hidden className="filter-chip-mark" />}
      {children}
    </button>
  );
}
