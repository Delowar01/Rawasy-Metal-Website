/**
 * The 2FA enrolment QR code as one SVG path (server side; no script and no inline style reach the page, so it works
 * under the admin's strict CSP). Error correction M; horizontal runs of dark modules are merged.
 */
import qrcode from "qrcode-generator";

export interface QrPath {
  /** Modules per side (the quiet zone is added by the viewBox). */
  size: number;
  d: string;
}

export function qrPath(text: string): QrPath {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; ) {
      if (!qr.isDark(row, col)) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < size && qr.isDark(row, col + run)) run++;
      d += `M${col} ${row}h${run}v1h-${run}z`;
      col += run;
    }
  }
  return { size, d };
}
