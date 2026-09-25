import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowIcon, ArrowUpRightIcon } from "./Icons";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  /** primary: orange (one main action per view); secondary: graphite → steel; outline; steel/teal: contextual. */
  variant?: "primary" | "secondary" | "outline" | "steel" | "teal";
  size?: "md" | "sm";
  icon?: "arrow" | "external" | "none" | ReactNode;
  external?: boolean;
  className?: string;
  cursor?: "view" | "explore" | "drag";
  "aria-label"?: string;
}

/** Chamfered button — the cut corner echoes laser-cut plate and the logo's angles. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  icon = "arrow",
  external,
  className,
  cursor,
  ...rest
}: ButtonLinkProps) {
  const classes = cn("btn", variant !== "primary" && `btn-${variant}`, size === "sm" && "btn-sm", className);
  const iconNode =
    icon === "arrow" ? (
      <ArrowIcon size={size === "sm" ? 16 : 18} className="rtl:-scale-x-100" />
    ) : icon === "external" ? (
      <ArrowUpRightIcon size={size === "sm" ? 16 : 18} className="rtl:-scale-x-100" />
    ) : icon === "none" ? null : (
      icon
    );
  const inner = (
    <>
      <span className="btn-face" aria-hidden />
      <span>{children}</span>
      {iconNode && <span className="btn-icon">{iconNode}</span>}
    </>
  );
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer" data-cursor={cursor} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} data-cursor={cursor} {...rest}>
      {inner}
    </Link>
  );
}
