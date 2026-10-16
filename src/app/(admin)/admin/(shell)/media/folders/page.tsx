import type { Metadata } from "next";
import { MediaFolders } from "../../../_components/media";

export const metadata: Metadata = { title: "Media folders" };

export default async function MediaFoldersPage() {
  return <MediaFolders />;
}
