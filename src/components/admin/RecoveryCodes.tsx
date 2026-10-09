"use client";
/** Recovery codes, shown once: copy or download them, then keep them somewhere safe (not on the same phone). */
import { useState } from "react";

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = `RAWASY admin — recovery codes (each works once)\n\n${codes.join("\n")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "rawasy-admin-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="adm-form" aria-labelledby="recovery-title">
      <h2 id="recovery-title">Save your recovery codes</h2>
      <p>
        If you lose your phone, each of these codes signs you in once instead of an authentication code.{" "}
        <strong>They are shown only now.</strong> Keep them in a password manager or on paper, away from your phone.
      </p>
      <ul className="adm-codes" aria-label="Recovery codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="adm-actions">
        <button
          type="button"
          className="adm-btn"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy codes"}
        </button>
        <button type="button" className="adm-btn" onClick={download}>
          Download as text
        </button>
      </div>
      <p className="adm-hint" role="status">
        {copied ? "The codes are on your clipboard." : ""}
      </p>
    </section>
  );
}
