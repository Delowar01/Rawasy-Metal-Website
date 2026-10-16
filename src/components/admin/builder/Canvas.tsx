"use client";
/**
 * The builder's live preview (A5 brief §36, §58–§59): the authenticated preview page of the saved working copy in a
 * frame of the admin's own origin, at a representative width (desktop 1280, tablet 768, phone 390 or 320 CSS px), scaled
 * down to fit the canvas without changing the page's own layout, in the chosen language and theme. The frame and the
 * builder talk only through `postMessage` with this origin (`preview-protocol.ts`): the builder says which section is
 * selected or pointed at; the frame says which sections it found (and its notes), and what was clicked in it. Nothing
 * the builder holds unsaved is sent to the frame; the frame always draws what is saved.
 */
import { useEffect, useRef } from "react";
import type { BuilderLocale } from "@/server/admin/actions/builder-model";
import { isPreviewMessage, type BuilderToPreview, type PreviewToBuilder } from "@/server/admin/actions/preview-protocol";

export type PreviewDevice = "desktop" | "tablet" | "phone" | "small";
export const DEVICES: { value: PreviewDevice; label: string; width: number; param: "desktop" | "tablet" | "mobile" }[] = [
  { value: "desktop", label: "Desktop (1280)", width: 1280, param: "desktop" },
  { value: "tablet", label: "Tablet (768)", width: 768, param: "tablet" },
  { value: "phone", label: "Phone (390)", width: 390, param: "mobile" },
  { value: "small", label: "Small phone (320)", width: 320, param: "mobile" },
];

/** The preview page's address for a language, theme and screen size (`frame` for the builder's canvas). */
export function previewUrl(href: string, locale: BuilderLocale, theme: "light" | "dark", device: PreviewDevice, frame: boolean) {
  const d = DEVICES.find((x) => x.value === device) ?? DEVICES[0];
  const params = new URLSearchParams({ locale, theme, device: d.param });
  if (frame) params.set("frame", "1");
  return `${href}?${params.toString()}`;
}

export function Canvas({
  href,
  title,
  locale,
  theme,
  device,
  version,
  selected,
  hovered,
  onMessage,
}: {
  href: string;
  title: string;
  locale: BuilderLocale;
  theme: "light" | "dark";
  device: PreviewDevice;
  /** The saved layout's version (a new one reloads the frame). */
  version: number;
  selected: string | null;
  hovered: string | null;
  onMessage: (message: PreviewToBuilder) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const width = (DEVICES.find((d) => d.value === device) ?? DEVICES[0]).width;
  const src = `${previewUrl(href, locale, theme, device, true)}&v=${version}`;

  // Fit the frame's width into the canvas (styles through the CSS object model: the admin's CSP refuses style attributes).
  useEffect(() => {
    const outer = box.current;
    const inner = frame.current;
    if (!outer || !inner) return;
    const fit = () => {
      // A hidden canvas (another tab on a phone) measures 0: it is fitted when it shows again.
      const available = outer.clientWidth;
      if (!available) return;
      const scale = Math.min(1, available / width);
      inner.style.width = `${width}px`;
      inner.style.height = `${Math.max(320, Math.round(outer.clientHeight / scale))}px`;
      inner.style.transform = scale < 1 ? `scale(${scale})` : "none";
      // A frame narrower than the canvas (a phone width on a desktop) stands in its middle.
      inner.style.left = scale < 1 ? "0px" : `${Math.floor((available - width) / 2)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [width, src]);

  // Messages from the frame: only from it, only from this origin, only the protocol's shapes. Once the frame has found
  // its sections ("ready"), it is told which one is selected.
  const handler = useRef(onMessage);
  const current = useRef(selected);
  useEffect(() => {
    handler.current = onMessage;
    current.current = selected;
  });
  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin || !isPreviewMessage(event.data)) return;
      if (event.data.type === "ready") frame.current?.contentWindow?.postMessage({ source: "rawasy-builder", type: "select", id: current.current, scroll: true } satisfies BuilderToPreview, window.location.origin);
      handler.current(event.data);
    };
    window.addEventListener("message", onWindowMessage);
    return () => window.removeEventListener("message", onWindowMessage);
  }, []);

  const send = (message: BuilderToPreview) => frame.current?.contentWindow?.postMessage(message, window.location.origin);
  useEffect(() => {
    send({ source: "rawasy-builder", type: "select", id: selected, scroll: true });
  }, [selected]);
  useEffect(() => {
    send({ source: "rawasy-builder", type: "hover", id: hovered });
  }, [hovered]);

  return (
    <div className="adm-bld-canvas" ref={box} data-device={device}>
      {/* Sandboxed (scripts and its own origin only): nothing in the preview — the third-party map and player frames it
          holds included — can navigate the builder, submit a form or open a window (A5 security review, F6). */}
      <iframe ref={frame} key={src} src={src} title={title} className="adm-bld-frame" sandbox="allow-scripts allow-same-origin" />
    </div>
  );
}
