import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { seo } from "@/content/seo";
import { isLocale } from "@/i18n/config";
import { buildMetadata, JsonLd, organizationJsonLd } from "@/lib/seo";
import { getShellView } from "@/components/commerce/data";
import { About } from "@/components/commerce/home/About";
import { Clients, Compliance } from "@/components/commerce/home/Clients";
import { Contact } from "@/components/commerce/home/Contact";
import { getHomeView } from "@/components/commerce/home/data";
import { CapabilityStrip, Hero } from "@/components/commerce/home/Hero";
import { Industries } from "@/components/commerce/home/Industries";
import { Machinery } from "@/components/commerce/home/Machinery";
import { Projects } from "@/components/commerce/home/Projects";
import { Services } from "@/components/commerce/home/Services";
import { PageShell } from "@/components/commerce/shell/PageShell";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    pathname: "/",
    title: seo.home.title[locale],
    description: seo.home.description[locale],
    absoluteTitle: true,
  });
}

/** The homepage in the Modern Commerce design (Stage TM-1): the approved A V2 composition on the website's routes. */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [shell, view] = await Promise.all([getShellView(locale, { route: "home", path: "/" }), getHomeView(locale)]);

  return (
    <PageShell shell={shell}>
      <JsonLd data={organizationJsonLd(locale)} />
      <Hero view={view} shell={shell} />
      <CapabilityStrip view={view} />
      <About view={view} />
      <Services view={view} />
      <Machinery view={view} quote={shell.ui.requestQuote} />
      <Projects view={view} />
      <Industries view={view} />
      {/* Clients and compliance share one sheet. */}
      <div className="sec-sheet sec-muted">
        <Clients view={view} />
        <Compliance view={view} />
      </div>
      <Contact view={view} shell={shell} />
    </PageShell>
  );
}
