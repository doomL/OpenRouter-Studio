"use client";

import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";
import { signOutAtCurrentOrigin } from "@/lib/studio-sign-out";

export function HomeSignOutButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1"
      onClick={() => void signOutAtCurrentOrigin("/auth/login")}
    >
      <LogOutIcon className="size-3.5" />
      Sign out
    </Button>
  );
}
