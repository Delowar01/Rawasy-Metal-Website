"use client";
/**
 * Upload a certificate's private original (A4 brief §49; Owner only — the server decides): a private item under the
 * private storage root, internal, never processed into anything public and never choosable for public content. The
 * person confirms they understand it can never be published before the file input opens. A redacted public copy is a
 * separate upload (the certificate's previews).
 */
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { MediaUploader } from "./MediaUploader";

export function PrivateOriginalUpload({ certificateId }: { certificateId: string }) {
  const router = useRouter();
  const id = useId();
  const [understood, setUnderstood] = useState(false);
  return (
    <div className="adm-subset">
      <p>
        <strong>This file can never be published.</strong> It is stored privately, has no public address or public preview, and only the Owner can open it (after
        confirming their identity).
      </p>
      <label className="adm-check" htmlFor={`${id}-ok`}>
        <input type="checkbox" id={`${id}-ok`} checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span>I understand that this file can never be published</span>
      </label>
      {understood ? (
        <MediaUploader
          purpose="private_original"
          certificateId={certificateId}
          label="Upload private original"
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,.jpg,.jpeg,.png,.webp,.avif,.pdf"
          hint="A PDF or an image of the original document. It is never redacted or converted automatically; upload a redacted copy separately as a public preview."
          onUploaded={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
