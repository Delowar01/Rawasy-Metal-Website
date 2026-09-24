import { WhatsAppIcon } from "@/components/ui/Icons";

/** Small, quiet floating WhatsApp link — no bounce, no flashing. */
export function WhatsAppButton({ href, label, text }: { href: string; label: string; text: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group fixed bottom-5 end-5 z-40 flex h-12 items-center overflow-hidden border border-line-strong bg-elevated/90 text-ink shadow-[var(--shadow-soft)] backdrop-blur-md transition-[border-color,background-color] duration-300 hover:border-accent sm:bottom-7 sm:end-7"
    >
      <span className="grid size-12 shrink-0 place-items-center">
        <span className="relative">
          <WhatsAppIcon size={20} />
          <span className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-[#25d366]" aria-hidden />
        </span>
      </span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[0.8125rem] font-semibold opacity-0 transition-[max-width,opacity,padding] duration-500 ease-out-expo group-hover:max-w-40 group-hover:pe-4 group-hover:opacity-100 group-focus-visible:max-w-40 group-focus-visible:pe-4 group-focus-visible:opacity-100">
        {text}
      </span>
    </a>
  );
}
