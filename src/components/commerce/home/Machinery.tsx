import type { HomeView } from "./data";
import { MachineShowcase } from "./MachineShowcase";
import { SectionHead } from "./SectionHead";

/** Machinery teaser: one machine on a lit stage, the others in a selector rail; each links to Capabilities. The machines come in the view's order. */
export function Machinery({ view, quote }: { view: HomeView; quote: string }) {
  const { machinery, links } = view;
  const items = machinery.items;
  return (
    <section id="machinery" className="sec sec-sheet sec-raised" aria-labelledby="machinery-title">
      <div className="shell">
        <SectionHead
          id="machinery-title"
          label={machinery.label}
          title={machinery.title}
          intro={machinery.intro}
          tone="steel"
          action={{ href: links.capabilities, label: machinery.all }}
        />
        <div className="mt-10 lg:mt-12" data-reveal>
          <MachineShowcase items={items} quote={links.quote} labels={{ power: machinery.power, service: machinery.service, list: machinery.label, quote }} />
        </div>
      </div>
    </section>
  );
}
