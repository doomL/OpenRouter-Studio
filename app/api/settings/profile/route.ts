import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Update display name for the signed-in user. */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const nameRaw = (body as Record<string, unknown>).name;
  if (nameRaw !== undefined && nameRaw !== null && typeof nameRaw !== "string") {
    return NextResponse.json({ error: "name must be a string" }, { status: 400 });
  }
  const name =
    typeof nameRaw === "string" ? nameRaw.trim().slice(0, 80) : "";

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.length > 0 ? name : null },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}
