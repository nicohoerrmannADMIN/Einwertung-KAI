-- ============================================================================
--  Einwertung-KAI — Absicherung der Mandantendaten
--  Supabase-Projekt: jtlblbgxzbxjplamdpiu
--
--  WICHTIG: Die Schritte in dieser Reihenfolge ausfuehren!
--  SCHRITT 1 kann sofort laufen (aendert nichts am Verhalten der App).
--  SCHRITT 3 erst, wenn der neue Code deployed ist (siehe SICHERHEIT.md).
-- ============================================================================


-- ============================================================================
--  SCHRITT 1 — Sichere Zugriffsfunktionen anlegen
--  Gefahrlos: legt nur neue Funktionen an, aendert nichts Bestehendes.
-- ============================================================================

-- Protokoll fehlgeschlagener PIN-Versuche (gegen Durchprobieren)
create table if not exists public.mandant_login_attempts (
  mandant_id   text        not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_mandant_login_attempts
  on public.mandant_login_attempts (mandant_id, attempted_at desc);

alter table public.mandant_login_attempts enable row level security;
-- keine Policy => niemand kommt direkt ran, nur die Funktionen unten


-- ---------------------------------------------------------------------------
--  Mandant laedt seine eigenen Daten — nur mit korrekter PIN
-- ---------------------------------------------------------------------------
create or replace function public.mandant_get(p_id text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin       text;
  v_data      jsonb;
  v_failures  int;
begin
  if p_id is null or p_pin is null then
    return null;
  end if;

  -- Bremse: max. 10 Fehlversuche pro Mandant in 15 Minuten
  select count(*) into v_failures
    from mandant_login_attempts
   where mandant_id = p_id
     and attempted_at > now() - interval '15 minutes';

  if v_failures >= 10 then
    return null;
  end if;

  select pin into v_pin from mandanten where id = p_id;

  if v_pin is null or v_pin <> p_pin then
    insert into mandant_login_attempts (mandant_id) values (p_id);
    return null;
  end if;

  -- Erfolg: Fehlversuche zuruecksetzen
  delete from mandant_login_attempts where mandant_id = p_id;

  select data into v_data from mandant_data where mandant_id = p_id;

  -- Fallback, falls noch keine Datenzeile existiert
  if v_data is null then
    select jsonb_build_object(
             'vorname',       vorname,
             'nachname',      nachname,
             'pin',           pin,
             'berater_nr',    berater_nr,
             'uploads',       '{}'::jsonb,
             'selbstauskunft', null,
             'crmData',       null,
             'adminData',     '{}'::jsonb
           )
      into v_data
      from mandanten
     where id = p_id;
  end if;

  return v_data;
end;
$$;


-- ---------------------------------------------------------------------------
--  Mandant speichert seine eigenen Daten — nur mit korrekter PIN
-- ---------------------------------------------------------------------------
create or replace function public.mandant_save(p_id text, p_pin text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  if p_id is null or p_pin is null or p_data is null then
    return false;
  end if;

  select pin into v_pin from mandanten where id = p_id;

  if v_pin is null or v_pin <> p_pin then
    return false;
  end if;

  insert into mandant_data (mandant_id, data)
  values (p_id, p_data)
  on conflict (mandant_id) do update set data = excluded.data;

  return true;
end;
$$;


-- Zugriffsrechte auf die Funktionen
revoke all on function public.mandant_get(text, text)         from public;
revoke all on function public.mandant_save(text, text, jsonb) from public;
grant execute on function public.mandant_get(text, text)         to anon, authenticated;
grant execute on function public.mandant_save(text, text, jsonb) to anon, authenticated;


-- ============================================================================
--  SCHRITT 3 — Tabellen abriegeln
--
--  ERST AUSFUEHREN, wenn der neue Code live ist und Schritt 1 + der
--  Datei-Dienst (Edge Function) funktionieren! Vorher bricht die
--  Mandantenseite.
--
--  Danach gilt: anon (= jeder Besucher) kommt an KEINE Tabelle mehr direkt
--  ran. Berater kommen ueber ihren Login (authenticated) weiterhin an alles.
-- ============================================================================

-- alter table public.mandanten    enable row level security;
-- alter table public.mandant_data enable row level security;
-- alter table public.berater      enable row level security;
--
-- create policy "berater voll mandanten"    on public.mandanten
--   for all to authenticated using (true) with check (true);
--
-- create policy "berater voll mandant_data" on public.mandant_data
--   for all to authenticated using (true) with check (true);
--
-- create policy "berater voll berater"      on public.berater
--   for all to authenticated using (true) with check (true);


-- ============================================================================
--  KONTROLLE — nach Schritt 3 ausfuehren, muss ueberall rowsecurity = true zeigen
-- ============================================================================
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--    and tablename in ('mandanten','mandant_data','berater','mandant_login_attempts');
