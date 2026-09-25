"use client";

import { useRef } from "react";
import { Icon } from "../Icon";

/* Design-system sheet controls: replay a signature illustration or a reveal, and a phone-width live preview. */

export function ReplaySignature({ target, label }: { target: string; label: string }) {
  const replay = () => document.getElementById(target)?.querySelector("svg.sig")?.dispatchEvent(new CustomEvent("sig:replay", { detail: { intro: true } }));
  return (
    <button type="button" className="btn btn-secondary btn-sm sig-replay" data-js-only onClick={replay}>
      <Icon name="replay" size={16} />
      {label}
    </button>
  );
}

export function ReplayReveal({ target, label }: { target: string; label: string }) {
  const replay = () => {
    const items = [...(document.getElementById(target)?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [])];
    // Back to the start state without a transition, then reveal again.
    items.forEach((el) => {
      el.style.transition = "none";
      el.querySelectorAll("img").forEach((img) => (img.style.transition = "none"));
      el.removeAttribute("data-shown");
    });
    void document.body.offsetHeight;
    items.forEach((el) => {
      el.style.transition = "";
      el.querySelectorAll("img").forEach((img) => (img.style.transition = ""));
    });
    requestAnimationFrame(() => requestAnimationFrame(() => items.forEach((el) => el.setAttribute("data-shown", ""))));
  };
  return (
    <button type="button" className="btn btn-secondary btn-sm sig-replay" data-js-only onClick={replay}>
      <Icon name="replay" size={16} />
      {label}
    </button>
  );
}

/** The homepage in a phone frame; the preview chrome (lab bar) is hidden inside it. */
export function PhonePreview({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    const style = doc.createElement("style");
    style.textContent = ".lab-bar{display:none!important}";
    doc.head.append(style);
  };
  return (
    <div className="a2-phone">
      <iframe ref={ref} src={src} title={title} loading="lazy" onLoad={onLoad} className="block h-full w-full rounded-[26px] bg-surface" />
    </div>
  );
}
