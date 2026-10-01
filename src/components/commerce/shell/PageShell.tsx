import type { ReactNode } from "react";
import type { ShellView } from "../data";
import { Footer } from "./Footer";
import { Header, type SameAddressLink } from "./Header";

/**
 * A Modern Commerce page: the skip link, the header, the page's main content and the footer. A page without an address
 * of its own (the 404) passes `sameAddressLink` for the header's language links.
 */
export function PageShell({ shell, sameAddressLink, children }: { shell: ShellView; sameAddressLink?: SameAddressLink; children: ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        {shell.ui.skip}
      </a>
      <Header shell={shell} sameAddressLink={sameAddressLink} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer shell={shell} />
    </>
  );
}
