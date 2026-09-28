import type { ShellView } from "../data";
import { Icon, type IconName } from "../Icon";
import type { Tone } from "../types";
import { Photo } from "../ui";
import type { HomeView } from "./data";

/** Phone, WhatsApp, email and address as tone-coded rows (links lift and fill their icon on hover). */
function ContactRows({ shell }: { shell: ShellView }) {
  const { contact, ui } = shell;
  const rows: { icon: IconName; tone: Tone; label: string; value: string; href?: string; ltr?: boolean }[] = [
    { icon: "phone", tone: "steel", label: ui.call, value: contact.phones[0].display, href: contact.phones[0].href, ltr: true },
    { icon: "chat", tone: "teal", label: ui.whatsapp, value: contact.phones[0].display, href: contact.whatsappHref, ltr: true },
    { icon: "mail", tone: "steel", label: ui.email, value: contact.email, href: contact.emailHref, ltr: true },
    { icon: "pin", tone: "brass", label: ui.address, value: contact.address.full },
  ];
  return rows.map((row) => {
    const inner = (
      <>
        <span className="icon-chip shrink-0">
          <Icon name={row.icon} size={20} />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.78rem] font-medium text-ink-2">{row.label}</span>
          <span className="block font-semibold break-words" dir={row.ltr ? "ltr" : undefined}>
            {row.value}
          </span>
        </span>
        {row.href && <Icon name="arrow" size={16} className="go ms-auto shrink-0 text-ink-3 max-sm:hidden lg:max-xl:hidden" />}
      </>
    );
    return row.href ? (
      <a key={row.label} href={row.href} className="contact-row card-link" data-tone={row.tone}>
        {inner}
      </a>
    ) : (
      <div key={row.label} className="contact-row" data-tone={row.tone}>
        {inner}
      </div>
    );
  });
}

/** Start a project: the three steps, the quote form and WhatsApp on a dark panel, and every way to reach RAWASY. */
export function Contact({ view, shell }: { view: HomeView; shell: ShellView }) {
  const { cta, links } = view;
  const { contact, ui } = shell;
  return (
    <section id="contact" className="sec" aria-labelledby="contact-title">
      <div className="shell">
        <div className="a2-cta grid grid-cols-1 lg:grid-cols-12" data-reveal>
          <div className="a2-cta-dark p-6 sm:p-10 lg:col-span-7 lg:p-12">
            <Photo image={cta.image} alt="" sizes="(min-width: 1024px) 760px, 100vw" className="-z-[2] object-cover object-[50%_40%]" />
            <p className="eyebrow eyebrow-dark">{cta.label}</p>
            <h2 id="contact-title" className="t-h2 mt-5 max-w-[17em] text-white">
              {cta.title}
            </h2>
            <ol className="mt-7 grid gap-2.5 sm:grid-cols-3">
              {cta.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-3 rounded-[14px] border border-white/15 bg-white/[0.07] p-3.5 sm:flex-col sm:gap-2.5">
                  <span className="step-num">{i + 1}</span>
                  <span className="text-[0.9rem] font-medium leading-snug text-white">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={links.quote} className="btn btn-primary btn-lg">
                {ui.requestQuote}
                <Icon name="arrow" size={18} />
              </a>
              <a href={contact.whatsappHref} className="btn btn-on-dark btn-lg">
                <Icon name="chat" size={19} />
                {cta.whatsapp}
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 bg-surface-2 p-5 sm:p-8 lg:col-span-5 lg:p-10">
            <ContactRows shell={shell} />
          </div>
        </div>
      </div>
    </section>
  );
}
