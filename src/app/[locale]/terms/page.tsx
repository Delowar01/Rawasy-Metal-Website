import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("terms");

export const generateMetadata = route.generateMetadata;
export default route.Page;
