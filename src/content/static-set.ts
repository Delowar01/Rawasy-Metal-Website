/**
 * The whole static content layer as one object (A9): every value the public website reads from `src/content/*` and the
 * interface dictionaries, by the names the modules export them under. It is
 *
 * - the importer's source of truth (`src/server/migration/*`: the static website → the CMS working copies), and
 * - the shape the database read model rebuilds from published documents (`src/server/public/decode.ts`), so the
 *   database-mode modules (`src/content/live/*`) hand the components exactly the objects the static modules do.
 *
 * Imported with explicit `.ts` paths so server code, CLIs and tests (Node type stripping) can load it. Public pages never
 * import this file: they import the content modules themselves (which a database-mode build resolves to the live ones).
 */
import { about } from "./about.ts";
import { capabilitiesPage } from "./capabilities.ts";
import { certificates } from "./certificates.ts";
import { clients } from "./clients.ts";
import { company, primaryWhatsApp } from "./company.ts";
import { contactPage } from "./contact.ts";
import { home } from "./home.ts";
import { industries } from "./industries.ts";
import { legalChrome, legalDocuments } from "./legal.ts";
import { machines } from "./machines.ts";
import { mediaRegistry } from "./media.generated.ts";
import { capabilityStatements, metrics } from "./metrics.ts";
import { footerNav, headerNav, legalNav, routeLabels } from "./navigation.ts";
import { certificatesPage, clientsPage, industriesPage, projectDetailPage, projectsPage, servicePage, servicesPage } from "./pages.ts";
import { pillars } from "./pillars.ts";
import { processSteps } from "./process.ts";
import { projectCategories, projects, withheldMedia } from "./projects.ts";
import { seo, siteName } from "./seo.ts";
import { serviceDetails } from "./service-details.ts";
import { services } from "./services.ts";
import { getDictionary } from "../i18n/dictionaries.ts";

export function staticContentSet() {
  return {
    company,
    primaryWhatsApp,
    home,
    services,
    serviceDetails,
    machines,
    capabilitiesPage,
    projects,
    projectCategories,
    withheldMedia,
    industries,
    clients,
    certificates,
    pillars,
    metrics,
    capabilityStatements,
    processSteps,
    about,
    servicesPage,
    servicePage,
    industriesPage,
    clientsPage,
    certificatesPage,
    projectsPage,
    projectDetailPage,
    contactPage,
    legalDocuments,
    legalChrome,
    headerNav,
    footerNav,
    legalNav,
    routeLabels,
    seo,
    siteName,
    mediaRegistry,
    dictionaries: { en: getDictionary("en"), ar: getDictionary("ar") },
  };
}

/** Everything the public website reads from the content layer. */
export type ContentSet = ReturnType<typeof staticContentSet>;
