"use client";
import Link from "next/link";

/** Errors in admin pages: a plain message (details stay in the server log, by error code only). */
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="adm-entry">
      <div className="adm-entry-card">
        <div className="adm-entry-head">
          <h1>Something went wrong</h1>
          <p className="adm-muted">The admin could not load this page. If the database is unavailable, try again in a moment.</p>
        </div>
        <div className="adm-actions">
          <button type="button" className="adm-btn is-primary" onClick={reset}>
            Try again
          </button>
          <Link className="adm-btn" href="/admin">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
