"use client";

import { useEffect } from "react";
import { followSystemTheme, setTheme, useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "@/components/ui/Icons";

function originOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Compact icon toggle for the header. */
export function ThemeToggle({
  labels,
  className,
}: {
  labels: { toDark: string; toLight: string };
  className?: string;
}) {
  const theme = useTheme();
  useEffect(() => followSystemTheme(), []);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className={cn(
        "group relative grid size-10 place-items-center overflow-hidden text-ink transition-colors hover:text-accent-ink",
        className,
      )}
      aria-label={isDark ? labels.toLight : labels.toDark}
      title={isDark ? labels.toLight : labels.toDark}
      onClick={(e) => setTheme(isDark ? "light" : "dark", originOf(e.currentTarget))}
    >
      <span className="absolute inset-1 border border-line transition-colors group-hover:border-line-strong" aria-hidden />
      <SunIcon
        className="col-start-1 row-start-1 transition-[transform,opacity] duration-500 ease-out-expo dark:-translate-y-6 dark:rotate-90 dark:opacity-0"
      />
      <MoonIcon
        className="col-start-1 row-start-1 translate-y-6 -rotate-90 opacity-0 transition-[transform,opacity] duration-500 ease-out-expo dark:translate-y-0 dark:rotate-0 dark:opacity-100"
      />
    </button>
  );
}

/** Explicit Light / Dark segmented control (footer, mobile menu). */
export function ThemeSelect({
  labels,
  className,
}: {
  labels: { legend: string; light: string; dark: string };
  className?: string;
}) {
  const theme = useTheme();
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: labels.light, icon: <SunIcon size={16} /> },
    { value: "dark", label: labels.dark, icon: <MoonIcon size={16} /> },
  ];
  return (
    <div role="group" aria-label={labels.legend} className={cn("inline-flex border border-line p-1", className)}>
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={(e) => setTheme(option.value, originOf(e.currentTarget))}
            className={cn(
              "inline-flex h-9 items-center gap-2 px-3.5 text-sm font-medium transition-colors",
              active ? "bg-ink text-background" : "text-ink-2 hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
