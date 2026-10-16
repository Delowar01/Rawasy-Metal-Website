/** A section the preview cannot draw (unknown type, newer version, invalid data): an admin-only placeholder with its reason. */
export function InvalidSection({ id, label, problem }: { id: string; label: string; problem: string }) {
  return (
    <div className="shell gb-failed" data-section={id} lang="en" dir="ltr">
      <div className="gb-missing">
        <span className="gb-note">
          Preview only — “{label}” ({id}): {problem}
        </span>
      </div>
    </div>
  );
}
