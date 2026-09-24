import { createPlaceholderRoute } from "@/lib/placeholder-route";

const route = createPlaceholderRoute("capabilities");

export const generateMetadata = route.generateMetadata;
export default route.Page;
