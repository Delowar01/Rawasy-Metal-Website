import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { LineIcon } from "@/components/ui/LineIcons";

export interface CertificateCardData {
  slug: string;
  title: string;
  issuer: string;
  thumb: { src: string; width: number; height: number; blurDataURL: string };
}

/**
 * Certificates as brass-edged document cards: a redacted, blurred preview
 * on a paper plate, the document and its issuer. Each links to the
 * certificates page.
 */
export function CertificateCards({ certificates, href, action }: { certificates: CertificateCardData[]; href: string; action: string }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {certificates.map((cert, i) => (
        <li key={cert.slug} className="h-full" data-reveal style={{ ["--d" as string]: i * 90 } as CSSProperties}>
          <Link href={href} className="card card-edge card-link group flex h-full flex-col" data-tone="craft">
            <div className="proj-plate relative flex h-44 items-end justify-center overflow-hidden px-6 pt-6">
              <div className="relative h-full w-[62%] overflow-hidden border border-line bg-white shadow-[var(--shadow-image)]">
                <Image
                  src={cert.thumb.src}
                  alt=""
                  fill
                  sizes="180px"
                  placeholder="blur"
                  blurDataURL={cert.thumb.blurDataURL}
                  className="object-cover object-top"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="t-label flex items-center gap-2 tone-ink">
                <LineIcon name="certificate" size={16} />
                {cert.issuer}
              </p>
              <h3 className="t-h4 mt-3 text-ink">{cert.title}</h3>
              <span className="t-label mt-auto flex items-center gap-2 pt-5 text-ink">
                {action}
                <ArrowIcon size={14} className="card-arrow rtl:-scale-x-100" />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
