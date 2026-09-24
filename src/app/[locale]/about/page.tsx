import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("about");

export const generateMetadata = route.generateMetadata;
export default route.Page;
