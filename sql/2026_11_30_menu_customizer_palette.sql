-- Persist independent merchant-selected colors for the public menu.
-- The table is created by the merchant's existing Supabase setup; keep this
-- migration safe for CI/bootstrap environments where that optional table is absent.
do $$
begin
  if to_regclass('public.menu_customizer') is not null then
    alter table public.menu_customizer
      add column if not exists "customAccentColor" text not null default '',
      add column if not exists "customCardColor" text not null default '',
      add column if not exists "customButtonColor" text not null default '#4f46e5';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.menu_customizer') is not null then
    if not exists (
      select 1 from pg_constraint
       where conname = 'menu_customizer_palette_hex_check'
         and conrelid = 'public.menu_customizer'::regclass
    ) then
      alter table public.menu_customizer
        add constraint menu_customizer_palette_hex_check check (
          ("customAccentColor" = '' or "customAccentColor" ~ '^#[0-9A-Fa-f]{6}
        );
    end if;
  end if;
end
$$;
)
          and ("customCardColor" = '' or "customCardColor" ~ '^#[0-9A-Fa-f]{6}
        );
    end if;
  end if;
end
$$;
)
          and ("customButtonColor" = '' or "customButtonColor" ~ '^#[0-9A-Fa-f]{6}
        );
    end if;
  end if;
end
$$;
)
        );
    end if;
  end if;
end
$$;
