# Einwertung-KAI – Wartung & Setup

Diese Datei beschreibt alles, was die App zum Laufen braucht.
Wenn etwas kaputt ist: zuerst `pruefung.bat` doppelklicken (siehe unten).

## Was die App braucht

| Baustein | Wo | Was |
|---|---|---|
| Code | GitHub `nicohoerrmannADMIN/Einwertung-KAI` | Wird bei jedem Push automatisch neu deployed |
| Datenbank | Supabase-Projekt `jtlblbgxzbxjplamdpiu` | Tabelle `mandant_data` |
| Datei-Speicher | Supabase → Storage | Bucket `mandant-files`, **privat**, Policy nur für `authenticated` |
| Datei-Zugang Mandant | Supabase → Edge Functions | Funktion `mandant-file` (Verify JWT AUS) — gibt nach PIN-Prüfung Einmal-Links aus |
| Zugriffsschutz | Supabase → Datenbank | RLS an auf `mandanten` + `mandant_data`; Mandantenzugriff nur über `mandant_get` / `mandant_save` |

Wie die Absicherung funktioniert und was sie abwehrt: **`SICHERHEIT.md`**

## Supabase-Einstellungen (falls sie je neu angelegt werden müssen)

1. Dashboard: https://supabase.com/dashboard/project/jtlblbgxzbxjplamdpiu
2. Storage → New bucket → Name exakt `mandant-files` → „Public bucket" **AUS**
3. Storage-Policy im SQL Editor anlegen:

```sql
create policy mandant_files_berater on storage.objects
  for all to authenticated
  using (bucket_id = 'mandant-files')
  with check (bucket_id = 'mandant-files');
```

4. Edge Function `mandant-file` deployen (Code: `supabase/functions/mandant-file/`),
   danach für diese Funktion **„Verify JWT" ausschalten**.
5. Datenbankschutz + Zugriffsfunktionen: `SICHERHEIT.sql` ausführen.

> ⚠️ **Bucket niemals auf „Public" stellen und keine Policy für `anon` anlegen.**
> Dann wären sämtliche Mandantendokumente wieder für jeden im Internet abrufbar.
> Mandanten brauchen keinen direkten Zugriff — sie laden über die Edge Function
> hoch und herunter, die ihnen nach PIN-Prüfung kurzlebige Einmal-Links ausstellt.

Ohne Bucket: Fehler „Bucket not found" → Mandanten sehen „Hochladen fehlgeschlagen".
Ohne Edge Function: Upload/Download beim Mandanten schlägt fehl (Berater-Ansicht läuft weiter).

## Regeln, damit nichts kaputt geht

1. **Nach jeder Änderung selbst testen:** Eigenen Mandanten-Test-Link auf dem
   Handy öffnen, ein Foto hochladen, einen Schritt der Selbstauskunft ausfüllen.
   Erst dann ist die Änderung „fertig".
2. **Änderungen nur an einem Ort machen:** Entweder lokal (dieser Ordner + `push.bat`)
   ODER auf github.com – nie beides parallel. Sonst überschreibt eins das andere.
3. **`pruefung.bat` doppelklicken**, wenn ein Mandant ein Problem meldet –
   das zeigt in 10 Sekunden, ob Datenbank und Datei-Speicher funktionieren.
4. **Supabase-Free-Plan:** Projekte im Free-Plan werden nach längerer Inaktivität
   pausiert. Wenn das Portal „Verbindung fehlgeschlagen" zeigt: im Dashboard
   nachsehen, ob das Projekt pausiert ist, und „Restore" klicken.

## Vorfall-Historie

- **30.06.–02.07.2026:** Umstellung auf Supabase Storage deployed, aber Bucket
  `mandant-files` existierte nicht → alle Uploads schlugen fehl. Fix: Bucket +
  Policy angelegt (siehe oben). Uploads aus diesem Zeitraum sind verloren.
