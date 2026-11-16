import { fixedPageBoundary } from "@/content/live/fixed-not-found";

const boundary = fixedPageBoundary("terms");
export default boundary.FixedPageNotFound;
export const generateMetadata = boundary.generateMetadata;
