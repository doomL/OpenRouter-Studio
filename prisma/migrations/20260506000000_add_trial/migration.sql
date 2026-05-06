-- Add trial support: null = permanent access, non-null = trial expires at that time.
-- Existing users keep null (permanent access, grandfathered).
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
