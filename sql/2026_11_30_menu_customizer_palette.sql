-- Persist optional independent merchant-selected colors for the public menu.
-- The table is created by the merchant's existing Supabase setup. In isolated
-- CI databases the table may be absent, so this migration is intentionally safe.
DO $migration$
BEGIN
  IF to_regclass('public.menu_customizer') IS NOT NULL THEN
    ALTER TABLE public.menu_customizer
      ADD COLUMN IF NOT EXISTS "customAccentColor" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "customCardColor" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "customButtonColor" text NOT NULL DEFAULT '';
  END IF;
END;
$migration$;
