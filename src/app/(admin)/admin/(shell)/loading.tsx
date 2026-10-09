/** Shown while an admin page loads. */
export default function Loading() {
  return (
    <div className="adm-loading" role="status" aria-label="Loading">
      <div className="adm-skeleton is-title" />
      <div className="adm-skeleton" />
      <div className="adm-skeleton is-block" />
    </div>
  );
}
