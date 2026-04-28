import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MediaLibraryClient } from "@/components/media/MediaLibraryClient";

export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }
  return <MediaLibraryClient />;
}
