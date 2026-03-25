import NextAuth from "next-auth";
import { edgeAuthConfig } from "@/lib/auth.edge.config";

const { auth } = NextAuth(edgeAuthConfig);
export const middleware = auth;

export const config = {
  matcher: ["/studio/:path*"],
};
