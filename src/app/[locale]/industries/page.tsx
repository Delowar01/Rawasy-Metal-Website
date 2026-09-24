import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("industries");

export const generateMetadata = route.generateMetadata;
export default route.Page;
