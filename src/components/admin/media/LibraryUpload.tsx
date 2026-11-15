"use client";
/** The library's upload: a new public-class item (pending review), opened once it is processed. */
import { useRouter } from "next/navigation";
import { MediaUploader } from "./MediaUploader";

/** `hint`: what the release does with an approved item (src/server/admin/public-effect.ts, chosen by the server). */
export function LibraryUpload({ folderId, hint }: { folderId?: string; hint: string }) {
  const router = useRouter();
  return (
    <MediaUploader
      purpose="new"
      folderId={folderId}
      label="Upload a file"
      hint={hint}
      onUploaded={(item) => router.push(`/admin/media/${item.mediaId}?uploaded=1`)}
    />
  );
}
