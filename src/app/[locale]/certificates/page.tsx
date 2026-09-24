import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("certificates");

export const generateMetadata = route.generateMetadata;
export default route.Page;
