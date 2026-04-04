ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "draftBrandingConfig" JSONB,
  ADD COLUMN IF NOT EXISTS "publishedBrandingConfig" JSONB,
  ADD COLUMN IF NOT EXISTS "brandingPublishedAt" TIMESTAMP(3);
