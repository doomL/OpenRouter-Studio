import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Approve a user for permanent beta access.
 * Sets trialEndsAt = null, which grants unlimited access.
 *
 * Usage: GET /api/admin/approve?email=user@example.com&secret=YOUR_ADMIN_SECRET
 *
 * The user must log out and log back in for the change to take effect
 * (trialEndsAt is cached in the JWT token).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const email = searchParams.get("email");

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  await prisma.user.update({
    where: { email },
    data: { trialEndsAt: null },
  });

  return NextResponse.json({
    ok: true,
    message: `User ${email} approved. They must log out and log back in to gain full access.`,
  });
}
