/**
 * Response headers of media downloads (framework-free, unit-tested): an RFC 6266 / RFC 5987 Content-Disposition whose
 * file name is sanitized twice — an ASCII fallback and the UTF-8 name — so no quote, backslash, separator or control
 * character can end the header or add a parameter.
 */
export function contentDisposition(kind: "attachment" | "inline", filename: string): string {
  const clean = filename.replace(/[\u0000-\u001f\u007f-\u009f"\\/;]/g, "_").slice(0, 200) || "file";
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
  const encoded = encodeURIComponent(clean).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
