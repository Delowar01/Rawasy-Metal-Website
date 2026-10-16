/**
 * Every block type of the page builder, in the order the library lists them: the bespoke blocks of the approved pages
 * (A5 brief §11: 59 types), then the generic blocks (§12: 28 types, the library-only "reusable section" entry included).
 */
import type { BlockDefinition } from "../block.ts";
import { ABOUT_BLOCKS } from "./about.ts";
import { CAPABILITIES_BLOCKS } from "./capabilities-projects.ts";
import { COMPANY_BLOCKS } from "./company.ts";
import { GENERIC_BLOCKS } from "./generic.ts";
import { HOME_BLOCKS } from "./home.ts";
import { PAGE_BLOCKS } from "./page.ts";
import { SERVICE_BLOCKS } from "./services.ts";

export const BESPOKE_BLOCKS: readonly BlockDefinition[] = [...HOME_BLOCKS, ...PAGE_BLOCKS, ...ABOUT_BLOCKS, ...SERVICE_BLOCKS, ...CAPABILITIES_BLOCKS, ...COMPANY_BLOCKS];

export const ALL_BLOCKS: readonly BlockDefinition[] = [...BESPOKE_BLOCKS, ...GENERIC_BLOCKS];
