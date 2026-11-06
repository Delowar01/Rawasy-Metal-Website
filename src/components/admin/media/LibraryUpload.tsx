"use client";
/** The library's upload: a new public-class item (pending review), opened once it is processed. */
import { useRouter } from "next/navigation";
import { MediaUploader } from "./MediaUploader";

export function LibraryUpload({ folderId }: { folderId?: string }) {
  const router = useRouter();
  return (
    <MediaUploader
      purpose="new"
      folderId={folderId}
      label="Upload a file"
      hint="JPEG, PNG, WebP, AVIF or PDF; at most 20 MB and 40 megapixels. The file's real type is checked, not its name. It starts as pending review: a version that uses it can be published only once an Owner or Admin approves it, and the public website reads published versions only from the content cutover (A9)."
      onUploaded={(item) => router.push(`/admin/media/${item.mediaId}?uploaded=1`)}
    />
  );
}
