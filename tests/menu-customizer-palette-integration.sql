-- Verify the optional menu customizer palette columns are present.
DO $test$
DECLARE
  v_table regclass := to_regclass('public.menu_customizer');
BEGIN
  IF v_table IS NULL THEN
    RAISE NOTICE 'menu_customizer is not part of this isolated bootstrap; palette migration safely skipped';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_customizer' AND column_name='customAccentColor')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_customizer' AND column_name='customCardColor')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='menu_customizer' AND column_name='customButtonColor') THEN
    RAISE EXCEPTION 'MENU_CUSTOMIZER_PALETTE_COLUMNS_MISSING';
  END IF;
END;
$test$;
