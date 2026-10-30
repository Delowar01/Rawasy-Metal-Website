"use client";
/** Remove every design-token override (back to the approved design): the Owner, with a recent sign-in (step-up). */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetThemeAction } from "@/server/admin/actions/site";
import type { SiteActionState } from "@/server/admin/actions/site-model";

export function ThemeReset({ lockVersion }: { lockVersion: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SiteActionState>({ status: "idle" });
  return (
    <div className="adm-site-setup">
      <button
        type="button"
        className="adm-btn is-danger"
        disabled={pending}
        aria-disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await resetThemeAction({ expectedVersion: lockVersion });
            setState(result);
            if (result.status === "ok") router.replace("/admin/theme?saved=1", { scroll: false });
          })
        }
      >
        {pending ? "Working…" : "Remove every override"}
      </button>
      <div role="status" aria-live="polite">
        {state.status === "error" ? <p className="adm-alert is-error">{state.message}</p> : null}
      </div>
    </div>
  );
}
