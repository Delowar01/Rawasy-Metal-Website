"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ProjectCategory } from "@/content/types";
import { Icon } from "../Icon";
import type { Tone } from "../types";
import type { ProjectView } from "./data";

/*
 * The gallery's category choice (Stage TM-2.5): one choice shared by the hero's quick toggles and the gallery's bar, and
 * the gallery itself. Each project is a list item whose id is its slug (`/projects#<slug>` lands on it); a project the
 * choice leaves out is `hidden`, so it leaves the page and the accessibility tree. The page always opens on "All": no
 * choice is stored, so an address with a project's #slug finds it. Without script every project shows and the toggles
 * are not drawn (`data-js-only`).
 */

export type Filter = ProjectCategory | "all";

export interface FilterOption {
  slug: ProjectCategory;
  label: string;
  tone: Tone;
}

interface FilterState {
  choice: Filter;
  /** Sets the choice; `animate` re-flows the gallery with the browser's animated page update (startViewTransition). */
  select: (next: Filter, animate?: boolean) => void;
}

const FilterContext = createContext<FilterState | null>(null);

function useProjectFilter() {
  const state = useContext(FilterContext);
  if (!state) throw new Error("useProjectFilter must be used inside <ProjectFilterProvider>");
  return state;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The gallery item an address fragment names, when the choice has left it out. */
function hiddenProject(fragment: string | null) {
  if (!fragment || fragment.length < 2 || !fragment.startsWith("#")) return null;
  let id: string;
  try {
    id = decodeURIComponent(fragment.slice(1));
  } catch {
    return null;
  }
  const item = document.getElementById(id);
  return item?.matches("[data-project][hidden]") ? item : null;
}

/** Holds the choice. Only a link or an address that names a project the choice hides changes it from outside. */
export function ProjectFilterProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Filter>("all");

  const select = useCallback((next: Filter, animate = true) => {
    if (!animate || reducedMotion() || typeof document.startViewTransition !== "function") {
      setChoice(next);
      return;
    }
    // The gallery's items take their names for the animated update only while this attribute is set (projects.css),
    // so no other one (the theme switch, a page change) ever captures them.
    const root = document.documentElement;
    root.setAttribute("data-vt", "gallery-filter");
    const vt = document.startViewTransition(() => flushSync(() => setChoice(next)));
    vt.finished.finally(() => root.removeAttribute("data-vt"));
  }, []);

  useEffect(() => {
    // A link to a project the choice hides (the index, the featured project, the highlights) shows every project
    // before the browser follows it, so its own jump lands on the item, never on a hidden one: no scrolling here.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href^='#']") : null;
      if (link && hiddenProject(link.getAttribute("href"))) flushSync(() => setChoice("all"));
    };
    // An address typed in, or reached through the history, naming a hidden project: show every project, then go to it.
    const onHash = () => {
      const item = hiddenProject(location.hash);
      if (!item) return;
      flushSync(() => setChoice("all"));
      item.scrollIntoView({ block: "start" });
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const value = useMemo(() => ({ choice, select }), [choice, select]);
  return <FilterContext value={value}>{children}</FilterContext>;
}

/** The category toggles: "All" and each classification, one pressed at a time (a check marks it, not colour alone). */
function Chips({
  label,
  options,
  allLabel,
  choice,
  onChoose,
  className,
}: {
  label: string;
  options: FilterOption[];
  allLabel: string;
  choice: Filter;
  onChoose: (next: Filter) => void;
  className: string;
}) {
  return (
    <div role="group" aria-label={label} className={className}>
      <Chip pressed={choice === "all"} onClick={() => onChoose("all")}>
        {allLabel}
      </Chip>
      {options.map((option) => (
        <Chip key={option.slug} pressed={choice === option.slug} onClick={() => onChoose(option.slug)} tone={option.tone}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

function Chip({ pressed, onClick, tone, children }: { pressed: boolean; onClick: () => void; tone?: Tone; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className="pj-chip" data-tone={tone}>
      <span aria-hidden className="pj-chip-mark">
        <svg viewBox="0 0 24 24" width="14" height="14" focusable="false">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      {children}
    </button>
  );
}

/** The hero's quick toggles: set the gallery's choice and go to the gallery. */
export function QuickFilter({ label, options, allLabel }: { label: string; options: FilterOption[]; allLabel: string }) {
  const { choice, select } = useProjectFilter();
  const choose = (next: Filter) => {
    select(next, false);
    // The page's own scroll behaviour: a glide once the page has settled, instant with reduced motion.
    document.getElementById("gallery")?.scrollIntoView({ block: "start" });
  };
  return (
    <div className="pj-quick" data-js-only>
      <p aria-hidden className="pj-quick-label">
        {label}
      </p>
      <Chips label={label} options={options} allLabel={allLabel} choice={choice} onChoose={choose} className="pj-chips pj-chips-wrap" />
    </div>
  );
}

/**
 * The gallery: the bar of category toggles, pinned under the header while the gallery scrolls (one row of fixed height,
 * scrolled sideways when the toggles do not fit), the announcement of the choice and the masonry wall of every project.
 */
export function Gallery({
  projects,
  options,
  labels,
}: {
  projects: ProjectView[];
  options: FilterOption[];
  labels: { group: string; all: string; showing: string; ref: string; view: string };
}) {
  const { choice, select } = useProjectFilter();
  const bar = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const current = choice === "all" ? labels.all : options.find((o) => o.slug === choice)?.label;

  const choose = (next: Filter) => {
    // With the bar pinned over the wall, the wall starts again just under it (its place changes, so no animation).
    if (bar.current && list.current && list.current.getBoundingClientRect().top < bar.current.getBoundingClientRect().bottom) {
      select(next, false);
      list.current.scrollIntoView({ block: "start", behavior: "instant" });
      return;
    }
    select(next);
  };

  return (
    <>
      <div ref={bar} className="pj-bar" data-js-only>
        <div className="shell">
          <Chips label={labels.group} options={options} allLabel={labels.all} choice={choice} onChoose={choose} className="pj-chips pj-chips-row" />
        </div>
      </div>
      <div className="shell">
        <p className="sr-only" aria-live="polite">
          {`${labels.showing}: ${current}`}
        </p>
        <ul ref={list} className="pj-list">
          {projects.map((p) => {
            const shown = choice === "all" || p.categories.some((c) => c.slug === choice);
            return (
              // No reveal: links land on these items, and a reveal would hide the ones a new choice brings in.
              <li
                key={p.slug}
                id={p.slug}
                hidden={!shown}
                className="pj-item"
                data-project=""
                data-categories={p.categories.map((c) => c.slug).join(" ")}
                style={{ ["--vt-name" as string]: `pj-${p.slug}` }}
              >
                <GalleryCard project={p} refLabel={labels.ref} viewLabel={labels.view} />
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/**
 * A project in the wall: its photos (never above their source size), reference, name and classifications. The card is
 * not a link; since Stage 1F one explicit link under the classifications opens the project's own page (its text names
 * the project for assistive technology).
 */
function GalleryCard({ project: p, refLabel, viewLabel }: { project: ProjectView; refLabel: string; viewLabel: string }) {
  const [first, second] = p.images;
  return (
    <div className="card pj-card" data-tone={p.tone}>
      {p.mode === "pair" && second ? (
        <div className="pj-media pj-media-pair">
          {[first, second].map((image) => (
            <Image
              key={image.src}
              src={image.src}
              alt=""
              width={image.width}
              height={image.height}
              sizes={`${Math.min(image.width, 190)}px`}
              placeholder="blur"
              blurDataURL={image.blurDataURL}
              className="pj-img"
              style={{ flex: `${image.width / image.height} 1 0`, maxWidth: image.width }}
            />
          ))}
        </div>
      ) : (
        <div className={p.mode === "framed" ? "pj-media pj-media-framed" : "pj-media"}>
          <Image
            src={first.src}
            alt=""
            width={first.width}
            height={first.height}
            sizes={`${Math.min(first.width, 380)}px`}
            placeholder="blur"
            blurDataURL={first.blurDataURL}
            className="pj-img"
            style={{ width: `min(100%, ${first.width}px)` }}
          />
        </div>
      )}
      <div className="pj-card-body">
        <p className="pj-ref">
          <span aria-hidden className="pj-dot" />
          <span dir="ltr">
            {refLabel} {p.ref}
          </span>
        </p>
        <h3 className="t-h4 pj-card-title">{p.title}</h3>
        <p className="pj-cats">{p.categories.slice(0, 2).map((c) => c.label).join(" · ")}</p>
        <a href={p.href} className="pj-card-go">
          {viewLabel}
          <span className="sr-only">: {p.title}</span>
          <Icon name="arrow" size={16} />
        </a>
      </div>
    </div>
  );
}
