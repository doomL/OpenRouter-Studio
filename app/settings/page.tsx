import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsPageClient } from "@/components/settings/SettingsPageClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user?.email) {
    redirect("/auth/login");
  }

  return (
    <SettingsPageClient
      initialUser={{
        name: user.name,
        email: user.email,
      }}
    />
  );
}
