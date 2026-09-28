import type { ReactNode } from "react";
import type { ShellView } from "../data";
import { Footer } from "./Footer";
import { Header } from "./Header";

/** A Modern Commerce page: the skip link, the header, the page's main content and the footer. */
export function PageShell({ shell, children }: { shell: ShellView; children: ReactNode }) {
  return (
    <>
      <a href="#main" className="skip-link">
        {shell.ui.skip}
      </a>
      <Header shell={shell} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer shell={shell} />
    </>
  );
}
