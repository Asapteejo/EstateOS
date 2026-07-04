-- Tenant site content CMS.
-- Stores per-company editable marketing copy (hero, footer, about) using the
-- same draft -> publish model as branding. Additive and nullable: existing
-- companies keep NULL and continue to render company-derived fallback copy until
-- they save and publish their own content. Idempotent for safe replay.
ALTER TABLE "SiteSettings"
ADD COLUMN IF NOT EXISTS "draftSiteContent" JSONB,
ADD COLUMN IF NOT EXISTS "publishedSiteContent" JSONB,
ADD COLUMN IF NOT EXISTS "siteContentPublishedAt" TIMESTAMP(3);
