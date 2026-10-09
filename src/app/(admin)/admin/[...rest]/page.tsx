import { notFound } from "next/navigation";

/** Unknown admin addresses get the admin's own 404 (never the public site's locale handling). */
export default function UnknownAdminPage() {
  notFound();
}
