# Einwertung-KAI – Wartung & Setup

Diese Datei beschreibt alles, was die App zum Laufen braucht.
Wenn etwas kaputt ist: zuerst `pruefung.bat` doppelklicken (siehe unten).

## Was die App braucht

| Baustein | Wo | Was |
|---|---|---|
| Code | GitHub `nicohoerrmannADMIN/Einwertung-KAI` | Wird bei jedem Push automatisch neu deployed |
| Datenbank | Supabase-Projekt `jtlblbgxzbxjplamdpiu` | Tabelle `mandant_data` |
| Datei-Speicher | Supabase → Storage | Bucket `mandant-files`, **Public**, mit einer Policy (SELECT+INSERT+UPDATE+DELETE für alle Rollen) |

## Supabase-Einstellungen (falls sie je neu angelegt werden müssen)

1. Dashboard: https://supabase.com/dashboard/project/jtlblbgxzbxjplamdpiu
2. Storage → New bucket → Name exakt `mandant-files` → „Public bucket" AN
3. Storage → Policies → beim Bucket `mandant-files` → New policy → „For full customization"
   → alle vier Operationen (SELECT, INSERT, UPDATE, DELETE) ankreuzen → speichern

Ohne Bucket: Fehler „Bucket not found" → Mandanten sehen „Hochladen fehlgeschlagen".
Ohne Policy: Fehler „violates row-level security policy" → gleiche Meldung beim Mandanten.

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
