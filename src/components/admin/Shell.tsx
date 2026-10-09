"use client";
/** Client parts of the admin shell: navigation links that mark the current page, and the session keeper. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { rotateSessionAction } from "@/server/admin/actions/auth";

export function NavLink({ href, children, exact = false }: { href: string; children: ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const current = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className="adm-nav-link" aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

/**
 * Rotates the session token every 30 minutes of use (A1-SECURITY-RBAC §3.3): checked when the admin opens and on
 * each page change — never on a timer, so an idle tab neither rotates nor stays alive.
 */
export function SessionKeeper({ rotateAt }: { rotateAt: number }) {
  const pathname = usePathname();
  const next = useRef(rotateAt);
  const busy = useRef(false);
  useEffect(() => {
    if (busy.current || Date.now() < next.current) return;
    busy.current = true;
    rotateSessionAction()
      .then((result) => {
        if (result.rotateAt) next.current = result.rotateAt;
      })
      .catch(() => {})
      .finally(() => {
        busy.current = false;
      });
  }, [pathname]);
  return null;
}

/** Closes the phone menu and the account menu after a navigation. */
export function MenuCloser() {
  const pathname = usePathname();
  useEffect(() => {
    document.querySelectorAll<HTMLDetailsElement>("details[data-adm-menu][open]").forEach((menu) => menu.removeAttribute("open"));
  }, [pathname]);
  return null;
}
