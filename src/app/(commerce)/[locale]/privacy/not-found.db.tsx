import { fixedPageBoundary } from "@/content/live/fixed-not-found";

const boundary = fixedPageBoundary("privacy");
export default boundary.FixedPageNotFound;
export const generateMetadata = boundary.generateMetadata;
