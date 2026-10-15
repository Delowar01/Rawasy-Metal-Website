"use client";
/**
 * A collection's order with Move up / Move down buttons (A3 brief §33): keyboard-usable, no drag and drop. Each move is
 * sent with the order's version as this page showed it; the server applies it under the order's lock or refuses it as
 * stale. Focus stays on the moved item's button, and the result is announced.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { moveContentAction } from "@/server/admin/actions/cms";
import { LOCALE_STATE_TEXT, type OrderRowModel } from "@/server/admin/actions/cms-model";

export function OrderList({ type, path, rows, lockVersion, canMove }: { type: string; path: string; rows: OrderRowModel[]; lockVersion: number; canMove: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const focusAfter = useRef<{ id: string; direction: "up" | "down" } | null>(null);
  const active = rows.filter((r) => !r.archived);

  // After a move, focus stays with the moved item: on the same button, or on the other one when the item reached an end.
  useEffect(() => {
    if (!focusAfter.current) return;
    const { id, direction } = focusAfter.current;
    focusAfter.current = null;
    const same = document.getElementById(`move-${direction}-${id}`) as HTMLButtonElement | null;
    const other = document.getElementById(`move-${direction === "up" ? "down" : "up"}-${id}`) as HTMLButtonElement | null;
    const target = same && !same.disabled ? same : other && !other.disabled ? other : document.getElementById("order-status");
    target?.focus();
  }, [rows]);

  const move = (id: string, direction: "up" | "down") =>
    startTransition(async () => {
      const result = await moveContentAction({ type, id, direction, version: lockVersion });
      setMessage({ ok: result.status === "ok", text: result.message });
      if (result.status === "ok") {
        focusAfter.current = { id, direction };
        router.refresh();
      }
    });

  if (!rows.length) return <p className="adm-empty">Nothing to order yet.</p>;
  return (
    <>
      <div id="order-status" tabIndex={-1} role="status" aria-live="polite" className="adm-order-status">
        {message ? <div className={`adm-alert ${message.ok ? "is-success" : "is-error"}`}>{message.text}</div> : null}
      </div>
      <ol className="adm-order">
        {rows.map((row) => {
          const index = active.findIndex((r) => r.id === row.id);
          return (
            <li key={row.id} className={`adm-order-item${row.archived ? " is-archived" : ""}`}>
              <span className="adm-order-pos" aria-hidden="true">
                {row.archived ? "–" : index + 1}
              </span>
              <span className="adm-order-name">
                <Link href={`${path}/${row.id}`}>{row.label}</Link>
                {row.slug ? <span className="adm-muted adm-mono"> {row.slug}</span> : null}
                <span className="adm-badges">
                  {row.archived ? <span className="adm-badge">Archived — keeps its place</span> : null}
                  <span className="adm-badge">EN {LOCALE_STATE_TEXT[row.state.en]}</span>
                  <span className="adm-badge">AR {LOCALE_STATE_TEXT[row.state.ar]}</span>
                </span>
              </span>
              {canMove && !row.archived ? (
                <span className="adm-order-buttons">
                  <button
                    type="button"
                    id={`move-up-${row.id}`}
                    className="adm-btn is-small"
                    onClick={() => move(row.id, "up")}
                    disabled={pending || index === 0}
                    aria-label={`Move ${row.label} up`}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    id={`move-down-${row.id}`}
                    className="adm-btn is-small"
                    onClick={() => move(row.id, "down")}
                    disabled={pending || index === active.length - 1}
                    aria-label={`Move ${row.label} down`}
                  >
                    Move down
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
