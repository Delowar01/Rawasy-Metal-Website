import Link from "next/link";
import type { ReactNode } from "react";

/** Sign-in, second factor, invitation and reset pages: one centred card, no navigation. */
export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="adm-entry">
      <div className="adm-entry-card">
        <Link className="adm-brand" href="/admin/login" aria-label="RAWASY Admin">
          <span className="adm-brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            RAWASY
            <small>Admin</small>
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
