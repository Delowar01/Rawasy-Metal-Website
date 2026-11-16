import { fixedPageBoundary } from "@/content/live/fixed-not-found";

const boundary = fixedPageBoundary("clients");
export default boundary.FixedPageNotFound;
export const generateMetadata = boundary.generateMetadata;
