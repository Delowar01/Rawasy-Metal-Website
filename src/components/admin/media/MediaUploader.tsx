"use client";
/**
 * Upload a file through the chunked upload protocol (A4 brief §24–§35): open → parts of the size the server names, each
 * sent with its exact length (progress per byte) → complete. The server checks everything again (type by signature,
 * limits, ownership, permission); this only drives the protocol and says what happens, with a progress bar and polite
 * announcements (§82). The library may already hold the same bytes: then the person chooses to use that item or to
 * upload anyway. Cancelling stops the transfer and ends the upload on the server.
 */
import { useId, useRef, useState } from "react";
import type { DuplicateModel, UploadedItem } from "@/server/admin/actions/media-model";

type Purpose = "new" | "replace" | "private_original";

type Phase =
  | { kind: "idle" }
  | { kind: "sending"; name: string; percent: number }
  | { kind: "processing"; name: string }
  | { kind: "duplicate"; name: string; uploadId: string; duplicates: DuplicateModel[] }
  | { kind: "done"; name: string; item: UploadedItem }
  | { kind: "error"; message: string };

const ERRORS: Record<number, string> = {
  401: "Your session has ended. Sign in again, then upload the file again.",
  403: "This upload was refused.",
  404: "This upload is no longer available. Start it again.",
  413: "The file is larger than allowed.",
  429: "Too many uploads at once or in the last hour. Wait, then try again.",
  503: "Uploads are not available on this server right now.",
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // No JSON body: fall back to the status's own message.
  }
  return ERRORS[response.status] ?? "The upload failed. Try again.";
}

/** Sends one part with byte-level progress (XMLHttpRequest reports upload progress; fetch does not). */
function sendPart(url: string, blob: Blob, onProgress: (sent: number) => void, signal: AbortSignal): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

export function MediaUploader({
  purpose,
  mediaId,
  certificateId,
  folderId,
  accept = "image/jpeg,image/png,image/webp,image/avif,application/pdf,.jpg,.jpeg,.png,.webp,.avif,.pdf",
  label,
  hint,
  onUploaded,
  onUseExisting,
}: {
  purpose: Purpose;
  mediaId?: string;
  certificateId?: string;
  folderId?: string;
  accept?: string;
  label: string;
  hint?: string;
  onUploaded?: (item: UploadedItem) => void;
  /** Offered beside a duplicate: use the existing item instead (e.g. choose it in a picker). */
  onUseExisting?: (id: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const current = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "sending" || phase.kind === "processing";

  const complete = async (uploadId: string, name: string, keepDuplicate: boolean) => {
    setPhase({ kind: "processing", name });
    const response = await fetch(`/api/admin/media/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keepDuplicate ? { keepDuplicate: true } : {}),
    });
    if (response.status === 409) {
      const body = (await response.json().catch(() => ({}))) as { error?: string; duplicates?: DuplicateModel[] };
      if (body.duplicates?.length) {
        setPhase({ kind: "duplicate", name, uploadId, duplicates: body.duplicates });
        return;
      }
      setPhase({ kind: "error", message: body.error ?? "This upload is already being completed." });
      return;
    }
    if (!response.ok) {
      setPhase({ kind: "error", message: await readError(response) });
      return;
    }
    const item = (await response.json()) as UploadedItem;
    current.current = null;
    setPhase({ kind: "done", name, item });
    onUploaded?.(item);
  };

  const start = async (file: File) => {
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: "sending", name: file.name, percent: 0 });
    try {
      const opened = await fetch("/api/admin/media/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, filename: file.name, size: file.size, ...(mediaId ? { mediaId } : {}), ...(certificateId ? { certificateId } : {}), ...(folderId ? { folderId } : {}) }),
        signal: controller.signal,
      });
      if (!opened.ok) {
        setPhase({ kind: "error", message: await readError(opened) });
        return;
      }
      const { uploadId, partSize, parts } = (await opened.json()) as { uploadId: string; partSize: number; parts: number };
      current.current = uploadId;
      let done = 0;
      for (let part = 1; part <= parts; part++) {
        const blob = file.slice((part - 1) * partSize, Math.min(file.size, part * partSize));
        const sent = await sendPart(
          `/api/admin/media/uploads/${uploadId}/parts/${part}`,
          blob,
          (bytes) => setPhase({ kind: "sending", name: file.name, percent: Math.min(99, Math.floor(((done + bytes) / Math.max(1, file.size)) * 100)) }),
          controller.signal,
        );
        if (sent.status < 200 || sent.status >= 300) {
          let message = ERRORS[sent.status] ?? "A part of the file could not be sent. Try again.";
          try {
            message = (JSON.parse(sent.text) as { error?: string }).error ?? message;
          } catch {
            // Keep the status's message.
          }
          setPhase({ kind: "error", message });
          return;
        }
        done += blob.size;
      }
      await complete(uploadId, file.name, false);
    } catch (error) {
      if ((error as DOMException).name === "AbortError") setPhase({ kind: "idle" });
      else setPhase({ kind: "error", message: "The connection was interrupted. Try again." });
    } finally {
      abort.current = null;
      if (input.current) input.current.value = "";
    }
  };

  const cancel = async () => {
    abort.current?.abort();
    const uploadId = current.current;
    current.current = null;
    if (uploadId) await fetch(`/api/admin/media/uploads/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
    setPhase({ kind: "idle" });
  };

  const status =
    phase.kind === "sending"
      ? `Uploading ${phase.name}: ${phase.percent}%`
      : phase.kind === "processing"
        ? `Checking and processing ${phase.name}…`
        : phase.kind === "done"
          ? `Uploaded ${phase.name}. Status: ${phase.item.statusLabel}.`
          : phase.kind === "duplicate"
            ? `The library already holds ${phase.name}.`
            : "";

  return (
    <div className="adm-uploader">
      <div className="adm-field">
        <label className="adm-label" htmlFor={`${id}-file`}>
          {label}
        </label>
        <input
          ref={input}
          id={`${id}-file`}
          className="adm-input adm-file"
          type="file"
          accept={accept}
          disabled={busy}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void start(file);
          }}
        />
        {hint ? (
          <p className="adm-hint" id={`${id}-hint`}>
            {hint}
          </p>
        ) : null}
      </div>
      {busy ? (
        <div className="adm-actions">
          <button type="button" className="adm-btn is-small" onClick={() => void cancel()}>
            Cancel upload
          </button>
        </div>
      ) : null}
      {phase.kind === "sending" ? <progress className="adm-progress" max={100} value={phase.percent} aria-label={`Uploading ${phase.name}`} /> : null}
      {phase.kind === "processing" ? <progress className="adm-progress" aria-label={`Processing ${phase.name}`} /> : null}
      <p className="adm-hint" role="status" aria-live="polite">
        {status}
      </p>
      {phase.kind === "error" ? (
        <div className="adm-alert is-error" role="alert">
          <p>{phase.message}</p>
        </div>
      ) : null}
      {phase.kind === "duplicate" ? (
        <div className="adm-alert is-warning" role="alert">
          <p>
            <strong>The library already holds this exact file.</strong> Use the existing item, or upload it anyway as a separate item.
          </p>
          <ul className="adm-list">
            {phase.duplicates.map((d) => (
              <li key={d.id}>
                <span>
                  {d.label} <span className="adm-badge">{d.status}</span>
                </span>{" "}
                {onUseExisting ? (
                  <button
                    type="button"
                    className="adm-btn is-small"
                    onClick={() => {
                      void fetch(`/api/admin/media/uploads/${phase.uploadId}`, { method: "DELETE" }).catch(() => undefined);
                      current.current = null;
                      setPhase({ kind: "idle" });
                      onUseExisting(d.id);
                    }}
                  >
                    Use this item
                  </button>
                ) : (
                  <a className="adm-btn is-small" href={`/admin/media/${d.id}`} target="_blank" rel="noopener">
                    Open it<span className="adm-sr-only"> (new tab)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="adm-actions">
            <button type="button" className="adm-btn is-primary" onClick={() => void complete(phase.uploadId, phase.name, true)}>
              Upload anyway
            </button>
            <button type="button" className="adm-btn" onClick={() => void cancel()}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
