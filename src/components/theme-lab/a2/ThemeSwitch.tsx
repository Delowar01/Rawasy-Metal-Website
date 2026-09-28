import { ThemeSwitch } from "@/components/commerce/ThemeSwitch";
import { THEME_KEY } from "./theme-boot";

/** A V2's light / dark switch in the lab: the production switch, remembering the lab's own choice (not the website's). */
export function ThemeSwitchA2(props: { label: string; light: string; dark: string; className?: string }) {
  return <ThemeSwitch {...props} storageKey={THEME_KEY} />;
}
