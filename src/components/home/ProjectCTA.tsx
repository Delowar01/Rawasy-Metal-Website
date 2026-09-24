import { ButtonLink } from "@/components/ui/ButtonLink";
import { MailIcon, PhoneIcon, WhatsAppIcon } from "@/components/ui/Icons";
import { MediaImage } from "@/components/ui/MediaImage";
import { Phrases } from "@/components/ui/Phrases";
import { SectionRule } from "@/components/visual/SectionRule";
import { FrameMarks } from "@/components/visual/TechnicalFrame";

export interface ProjectCTAProps {
  index: string;
  label: string;
  title: string;
  steps: string[];
  primary: { href: string; label: string };
  whatsapp: { href: string; label: string };
  phone: { display: string; href: string };
  email: string;
  imageAlt: string;
}

/** How do I start a project? — full-bleed Riyadh night, three steps, two ways in. */
export function ProjectCTA({ index, label, title, steps, primary, whatsapp, phone, email, imageAlt }: ProjectCTAProps) {
  return (
    <section aria-labelledby="cta-title" className="on-band relative isolate overflow-hidden bg-band text-band-ink">
      <div className="absolute inset-0 -z-10">
        <MediaImage id="site/riyadh-night" alt={imageAlt} fill sizes="100vw" quality={75} className="object-cover object-[50%_40%] opacity-55" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--band)_8%,rgb(17_18_19/0.72)_48%,rgb(17_18_19/0.35))] rtl:bg-[linear-gradient(270deg,var(--band)_8%,rgb(17_18_19/0.72)_48%,rgb(17_18_19/0.35))]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--band),transparent_45%)]" />
      </div>

      <div className="container-x py-[clamp(6rem,4rem+8vw,11rem)]">
        <SectionRule tone="band" className="mb-8" />
        <p className="t-label eyebrow !text-band-ink-2" data-reveal="fade">
          <span className="t-num">{index}</span>
          <span aria-hidden>/</span>
          <span>{label}</span>
        </p>
        <h2 id="cta-title" className="t-h2 mt-8 max-w-[15em]" data-reveal>
          <Phrases>{title}</Phrases>
        </h2>

        <div className="tf-host mt-14 max-w-4xl" data-reveal style={{ ["--d" as string]: 120 }}>
          <ol className="grid gap-px border border-band-line bg-band-line sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step} className="flex items-start gap-4 bg-band/80 p-5 backdrop-blur-sm">
                <span className="t-num text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[0.95rem] font-medium">{step}</span>
              </li>
            ))}
          </ol>
          <FrameMarks lines={false} />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3" data-reveal style={{ ["--d" as string]: 200 }}>
          <ButtonLink href={primary.href} className="[--btn-bg:var(--accent)] [--btn-fg:#17191a] [--btn-hover:#eceae5] [--btn-hover-fg:#17191a]">
            {primary.label}
          </ButtonLink>
          <ButtonLink href={whatsapp.href} variant="outline" external icon={<WhatsAppIcon size={18} />}>
            {whatsapp.label}
          </ButtonLink>
        </div>

        <div className="mt-14 flex flex-wrap gap-x-10 gap-y-3 text-sm text-band-ink-2">
          <a href={phone.href} className="inline-flex items-center gap-2.5 transition-colors hover:text-band-ink">
            <PhoneIcon size={16} className="text-accent" />
            <span className="t-num" dir="ltr">
              {phone.display}
            </span>
          </a>
          <a href={`mailto:${email}`} className="inline-flex items-center gap-2.5 transition-colors hover:text-band-ink">
            <MailIcon size={16} className="text-accent" />
            {email}
          </a>
        </div>
      </div>
    </section>
  );
}
