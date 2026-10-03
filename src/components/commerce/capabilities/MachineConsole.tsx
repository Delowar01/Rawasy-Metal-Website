"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";
import { Icon } from "../Icon";
import type { CapabilityMachine } from "./data";
import { MACHINE_EVENT } from "./machine-address";
import { MachinePhoto } from "./MachinePhoto";
import { Schematic } from "./Schematic";

export interface ConsoleLabels {
  list: string;
  showing: string;
  schematic: string;
  power: string;
  service: string;
  source: string;
  notStated: string;
  quote: string;
  /** "{service} service" / "خدمة {service}" */
  serviceLink: string;
}

/**
 * The machine the address names, remembered: a fragment that names no machine (the skip link's #main, a section of the
 * page) leaves the choice as it was. One store per console; the address stays the single source of the choice.
 */
function machineStore(slugs: string[]) {
  let current = slugs[0];
  return {
    read: () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (slugs.includes(id)) current = id;
      return current;
    },
    subscribe: (onChange: () => void) => {
      const events = ["hashchange", "popstate", MACHINE_EVENT];
      events.forEach((type) => window.addEventListener(type, onChange));
      return () => events.forEach((type) => window.removeEventListener(type, onChange));
    },
  };
}

/** Nothing on the server or while the page hydrates: the stylesheet shows the address's machine (:target) or the first. */
const serverMachine = () => null;

/**
 * The machinery console (Stage 1E): a selector of the six machines beside one equipment stage. Each machine is a panel
 * whose id is its slug, so every existing link to /capabilities#<slug> lands on it. Choosing a machine shows its panel and
 * writes its slug into the address (replacing the entry: Back still leaves the page), so the address and the machine
 * shown never disagree, and a link copied from the address opens the same machine; Back and Forward between addresses
 * that name machines follow them. The selector is plain links (no tab widget): each names its machine, the shown one is
 * marked `aria-current`, and a polite status announces a change.
 *
 * Without script the panels are a list — every machine, photo and figure on the page, each link jumping to its panel —
 * and before the script takes over, the stylesheet shows the address's machine (:target) or the first.
 */
export function MachineConsole({ machines, labels, quote }: { machines: CapabilityMachine[]; labels: ConsoleLabels; quote: string }) {
  const [store] = useState(() => machineStore(machines.map((m) => m.slug)));
  const active = useSyncExternalStore(store.subscribe, store.read, serverMachine);
  const ready = active !== null;
  const [status, setStatus] = useState("");
  const rail = useRef<HTMLOListElement>(null);
  const settled = useRef(false);

  const nameOf = (slug: string) => machines.find((m) => m.slug === slug)?.name ?? "";
  const announce = (slug: string) => setStatus(`${labels.showing}: ${nameOf(slug)}`);

  // A machine named by the address after the page has loaded (Back, Forward, a link on the page) is announced too.
  useEffect(() => {
    const onAddress = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (machines.some((m) => m.slug === id)) setStatus(`${labels.showing}: ${machines.find((m) => m.slug === id)!.name}`);
    };
    window.addEventListener("hashchange", onAddress);
    window.addEventListener("popstate", onAddress);
    return () => {
      window.removeEventListener("hashchange", onAddress);
      window.removeEventListener("popstate", onAddress);
    };
  }, [machines, labels.showing]);

  // Where the selector scrolls sideways (phones), the shown machine's card is kept in view inside it — the page itself
  // does not move. The first time (an address naming a machine), only once the page has settled: the browser keeps its
  // jump to the address's machine in place while the page loads, until anything scrolls, so a scroll of the selector
  // during loading would let a late font move the landing. The boot script marks the settled page (data-smooth-scroll,
  // after the load event and the fonts).
  useEffect(() => {
    const list = rail.current;
    if (!active || !list) return;
    const first = !settled.current;
    settled.current = true;
    const reveal = (behavior: ScrollBehavior) => {
      if (list.scrollWidth <= list.clientWidth) return;
      const card = list.querySelector<HTMLElement>(`a[href="#${active}"]`)!.getBoundingClientRect();
      const box = list.getBoundingClientRect();
      const by = card.left < box.left ? card.left - box.left - 8 : card.right > box.right ? card.right - box.right + 8 : 0;
      if (by) list.scrollBy({ left: by, behavior });
    };
    if (!first) return reveal(matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth");
    const root = document.documentElement;
    if (root.hasAttribute("data-smooth-scroll")) return reveal("instant");
    const settle = new MutationObserver(() => {
      if (!root.hasAttribute("data-smooth-scroll")) return;
      settle.disconnect();
      reveal("instant");
    });
    settle.observe(root, { attributes: true, attributeFilter: ["data-smooth-scroll"] });
    return () => settle.disconnect();
  }, [active]);

  const choose = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    // Opening the link elsewhere (a new tab or window) is left to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (slug === active) return;
    window.history.replaceState(null, "", `#${slug}`);
    window.dispatchEvent(new Event(MACHINE_EVENT));
    announce(slug);
  };

  return (
    <div className="cm-console" data-ready={ready ? "" : undefined} data-ambient>
      <nav className="cm-rail" aria-label={labels.list}>
        <ol ref={rail}>
          {machines.map((m) => (
            <li key={m.slug}>
              <a href={`#${m.slug}`} className="cm-pick" aria-current={m.slug === active ? "true" : undefined} onClick={(e) => choose(e, m.slug)}>
                <span className="cm-pick-thumb">
                  <MachinePhoto image={{ ...m.image, alt: "" }} />
                </span>
                <span className="cm-pick-text">
                  <span className="cm-pick-name">
                    <span className="cm-pick-n" aria-hidden dir="ltr">
                      {m.index}
                    </span>
                    {m.shortName}
                  </span>
                  {m.power && (
                    <span className="cm-pick-power">
                      <span dir="ltr">{m.power.value}</span> {m.power.unit}
                    </span>
                  )}
                  <span className="cm-pick-service">{m.service.name}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* The stage and the sheet behind the panels: one surface each, so a change of machine fades only what changes. */}
      <div className="cm-bay" aria-hidden>
        <span className="cm-axis" />
      </div>
      <div className="cm-sheet" aria-hidden />

      <div className="cm-panels">
        {machines.map((m) => {
          const shown = m.slug === active;
          return (
            <article
              key={m.slug}
              id={m.slug}
              className="cm-panel"
              data-machine=""
              data-active={shown ? "" : undefined}
              inert={ready && !shown}
              aria-labelledby={`${m.slug}-name`}
            >
              <div className="cm-shot">
                <span className="cm-chip cm-chip-index" aria-hidden dir="ltr">
                  <b>{m.index}</b> / {String(machines.length).padStart(2, "0")}
                </span>
                <figure className="cm-schem" aria-hidden>
                  <Schematic kind={m.schematic} />
                  <figcaption>{labels.schematic}</figcaption>
                </figure>
                <div className="cm-figure">
                  <MachinePhoto image={m.image} />
                </div>
                <span className="cm-floor-active" aria-hidden />
                <div className="cm-readout" aria-hidden>
                  <span className="cm-readout-label">{labels.power}</span>
                  {m.power ? (
                    <span className="cm-readout-value">
                      <span dir="ltr">{m.power.value}</span> <small>{m.power.unit}</small>
                    </span>
                  ) : (
                    <span className="cm-readout-none">{labels.notStated}</span>
                  )}
                </div>
                <span className="cm-chip cm-chip-source" aria-hidden>
                  {m.source}
                </span>
                <span className="cm-scan" aria-hidden />
              </div>

              <div className="cm-data">
                <h3 id={`${m.slug}-name`} className="t-h3 cm-data-name">
                  {m.name}
                </h3>
                <p className="cm-category">
                  <Icon name="machine" size={15} />
                  {m.category}
                </p>
                <p className="cm-capability">{m.capability}</p>
                <dl className="cm-spec">
                  <div>
                    <dt>
                      <Icon name="power" size={15} />
                      {labels.power}
                    </dt>
                    <dd>
                      {m.power ? (
                        <span className="cm-spec-power">
                          <span dir="ltr">{m.power.value}</span> {m.power.unit}
                        </span>
                      ) : (
                        <span className="cm-spec-none">{labels.notStated}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Icon name="layers" size={15} />
                      {labels.service}
                    </dt>
                    <dd>{m.service.name}</dd>
                  </div>
                  <div>
                    <dt>
                      <Icon name="doc" size={15} />
                      {labels.source}
                    </dt>
                    <dd>{m.source}</dd>
                  </div>
                </dl>
                <div className="cm-actions">
                  <a href={quote} className="btn btn-primary">
                    {labels.quote}
                    <Icon name="arrow" size={17} />
                  </a>
                  <a href={m.service.href} className="btn btn-secondary">
                    {labels.serviceLink.replace("{service}", m.service.name)}
                    <Icon name="arrow" size={17} />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
