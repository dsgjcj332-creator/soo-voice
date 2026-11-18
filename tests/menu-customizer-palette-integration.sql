-- Verify the optional menu customizer palette columns are present and constrained.
do $$
declare
  v_table regclass := to_regclass('public.menu_customizer');
begin
  if v_table is null then
    raise notice 'menu_customizer is not part of this isolated bootstrap; palette migration safely skipped';
    return;
  end if;

  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='menu_customizer' and column_name='customAccentColor')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='menu_customizer' and column_name='customCardColor')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='menu_customizer' and column_name='customButtonColor') then
    raise exception 'MENU_CUSTOMIZER_PALETTE_COLUMNS_MISSING';
  end if;

  if not exists (select 1 from pg_constraint where conname='menu_customizer_palette_hex_check' and conrelid=v_table) then
    raise exception 'MENU_CUSTOMIZER_PALETTE_CHECK_MISSING';
  end if;
end
$$;
