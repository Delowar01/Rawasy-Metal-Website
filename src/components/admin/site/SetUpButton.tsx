"use client";
/**
 * "Copy today's website" (A6): fills an empty working copy — the settings, the interface text or the navigation — from
 * what the public website shows today. Nothing changes for visitors; the screen opens again from what is stored.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUpNavigationAction, setUpSettingsAction, setUpUiTextAction } from "@/server/admin/actions/site";
import type { SiteActionState } from "@/server/admin/actions/site-model";
import { savedAt } from "./useSiteSave";

const ACTIONS = { settings: setUpSettingsAction, ui: setUpUiTextAction, navigation: setUpNavigationAction } as const;

export function SetUpButton({ part, label, savedHref }: { part: keyof typeof ACTIONS; label: string; savedHref: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SiteActionState>({ status: "idle" });
  return (
    <div className="adm-site-setup">
      <button
        type="button"
        className="adm-btn is-primary"
        disabled={pending}
        aria-disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await ACTIONS[part]();
            setState(result);
            if (result.status === "ok") router.replace(savedAt(savedHref, result.lockVersion), { scroll: false });
          })
        }
      >
        {pending ? "Copying…" : label}
      </button>
      <div role="status" aria-live="polite">
        {state.status === "error" ? <p className="adm-alert is-error">{state.message}</p> : null}
      </div>
    </div>
  );
}
