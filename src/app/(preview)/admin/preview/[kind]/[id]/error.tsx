"use client";

/** The preview could not be drawn at all (a database problem, or a fault no section caught): said plainly, never the error. */
export default function PreviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="shell gb-failed" lang="en" dir="ltr">
      <div className="gb-missing">
        <span className="gb-note">
          Preview only — this preview could not be drawn just now.{" "}
          <button type="button" onClick={reset} className="gb-note-retry">
            Try again
          </button>
        </span>
      </div>
    </main>
  );
}
