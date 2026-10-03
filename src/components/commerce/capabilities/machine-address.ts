/**
 * Fired on the window when the machinery console writes a machine into the address (history.replaceState fires no
 * hashchange), so whatever follows the address — the console itself, the language links — reads it again.
 */
export const MACHINE_EVENT = "mc:machine";
