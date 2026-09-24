import { Fragment } from "react";

const ARABIC = /[؀-ۿ]/;
const GLUE_AR = /(^|\s)(في|من|إلى|على|عن|مع|حتى|أو) /gu;
const GLUE_EN = /(^|\s)(a|an|the|&) /giu;

/**
 * Keeps short function words with the word that follows (and a dash with the
 * word before), so a heading never ends a line on "a", "من" or "إلى". Only
 * spaces become no-break spaces: the text reads the same.
 */
function keepTogether(text: string) {
  const glue = ARABIC.test(text) ? GLUE_AR : GLUE_EN;
  return text
    .replace(/ ([—–]) /g, " $1 ")
    .replace(glue, "$1$2 ")
    .replace(glue, "$1$2 ");
}

/**
 * Heading text that wraps at natural phrase boundaries: each sentence (or
 * Arabic "…" pause) moves to the next line as a whole before it wraps itself.
 */
export function Phrases({ children }: { children: string }) {
  const parts = children.split(/(?<=[.?!؟…])\s+/);
  if (parts.length === 1) return keepTogether(children);
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="inline-block">{keepTogether(part)}</span>
    </Fragment>
  ));
}
