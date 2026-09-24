import { company, whatsappUrl } from "@/content/company";
import { getDictionary } from "@/i18n/dictionaries";
import { createPlaceholderRoute } from "@/lib/placeholder-route";
import { MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/ui/Icons";

// The quote form (stage 1G) lands here; contact details are live already.
const route = createPlaceholderRoute("contact", (locale) => {
  const dict = getDictionary(locale);
  return (
    <address className="mt-10 grid max-w-3xl gap-6 border-y border-line py-8 not-italic sm:grid-cols-2">
      <p className="flex gap-3 text-ink-2">
        <PinIcon size={18} className="mt-1 shrink-0 text-accent-ink" />
        <span>{company.address[locale].full}</span>
      </p>
      <div className="grid gap-2">
        {company.phones.map((p) => (
          <a key={p.e164} href={`tel:${p.e164}`} className="flex items-center gap-3 text-ink hover:text-accent-ink">
            <PhoneIcon size={18} className="text-accent-ink" />
            <span className="t-num" dir="ltr">
              {p.display}
            </span>
          </a>
        ))}
      </div>
      <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-ink hover:text-accent-ink">
        <MailIcon size={18} className="text-accent-ink" />
        {company.email}
      </a>
      <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-ink hover:text-accent-ink">
        <WhatsAppIcon size={18} className="text-accent-ink" />
        {dict.common.whatsapp}
      </a>
    </address>
  );
});

export const generateMetadata = route.generateMetadata;
export default route.Page;
