import Link from "next/link";

export default function AdminNotFound() {
  return (
    <main id="main" className="adm-entry">
      <div className="adm-entry-card">
        <div className="adm-entry-head">
          <h1>Page not found</h1>
          <p className="adm-muted">There is no admin page at this address.</p>
        </div>
        <Link className="adm-btn" href="/admin">
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
