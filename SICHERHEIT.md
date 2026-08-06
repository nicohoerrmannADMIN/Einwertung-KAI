# Einwertung-KAI — Absicherung der Mandantendaten

## Worum es geht

Bis zur Umstellung konnte **jeder** — ohne Login, ohne PIN, nur mit dem
Schlüssel, der ohnehin im Quelltext der Seite steht — folgendes abrufen:

- alle Mandanten mit Klarnamen **und deren PINs**
- alle ausgefüllten Formulardaten
- den kompletten Datei-Bucket **auflisten** und damit jedes hochgeladene
  Dokument (Ausweis, Gehaltsnachweis, Steuerbescheid …) herunterladen

Der PIN-Bildschirm war reine Optik: Die Seite hatte die Daten samt PIN schon
geladen und nur im Browser verglichen. Wer die Entwicklertools öffnete, sah alles.

**Das ist mit den vier Schritten unten behoben.** Danach gilt:

| Wer | Kommt woran |
|---|---|
| Berater (eingeloggt) | an alles — über den bestehenden Supabase-Login |
| Mandant (Link + PIN) | **nur** an die eigenen Daten und die eigenen Dateien |
| alle anderen | an **nichts** |

---

## Reihenfolge einhalten!

Der neue Code ist bereits live und läuft im **Übergangsmodus**: Er versucht
zuerst den sicheren Weg und fällt auf den alten zurück, solange die
Datenbankfunktionen fehlen. Dadurch funktioniert die App während der ganzen
Umstellung durchgehend — aber **Schritt 4 riegelt erst wirklich ab**.

### Schritt 1 — Datenbankfunktionen anlegen *(gefahrlos, ändert nichts)*

1. Supabase-Dashboard → **SQL Editor**
2. Inhalt von `SICHERHEIT.sql` einfügen — nur den Teil **SCHRITT 1**
   (alles bis zur Zeile `SCHRITT 3`)
3. **Run**

Legt zwei geprüfte Zugriffsfunktionen an (`mandant_get`, `mandant_save`) sowie
eine Sperre gegen das Durchprobieren von PINs: Nach 10 Fehlversuchen ist ein
Mandant 15 Minuten lang gesperrt.

### Schritt 2 — Datei-Dienst deployen

Der Mandant darf künftig nicht mehr direkt auf den Datei-Speicher zugreifen.
Stattdessen bekommt er nach PIN-Prüfung einen 5-Minuten-Einmal-Link, der nur
für seinen eigenen Ordner gilt.

1. Supabase-Dashboard → **Edge Functions** → **Deploy a new function**
2. Name exakt: `mandant-file`
3. Inhalt von `supabase/functions/mandant-file/index.ts` einfügen → Deploy
4. **Wichtig:** In den Einstellungen der Funktion **„Verify JWT" ausschalten**.
   Die Funktion macht ihre eigene Prüfung über die PIN.

### Schritt 3 — Datei-Speicher abriegeln

1. Dashboard → **Storage** → Bucket `mandant-files` → Einstellungen →
   **„Public bucket" AUSschalten**
2. Storage → **Policies** → beim Bucket `mandant-files` die bestehende
   Rundum-Policy (SELECT+INSERT+UPDATE+DELETE für alle Rollen) **löschen**
3. Neue Policy anlegen, im SQL Editor:

```sql
create policy "mandant-files berater voll"
  on storage.objects for all to authenticated
  using (bucket_id = 'mandant-files')
  with check (bucket_id = 'mandant-files');
```

Danach kommt niemand mehr ohne Login oder ohne gültigen Einmal-Link an die Dateien.

### Schritt 4 — Tabellen abriegeln

1. Dashboard → **SQL Editor**
2. Aus `SICHERHEIT.sql` den Teil **SCHRITT 3** einfügen —
   die Zeilen sind mit `--` auskommentiert, also **vorher die `--` entfernen**
3. **Run**

Ab jetzt ist die Datenbank dicht.

---

## Kontrolle — muss nach Schritt 4 alles fehlschlagen

Im Terminal ausführen. Erwartet wird jeweils `[]` bzw. ein Fehler —
**nicht** eine Liste mit echten Daten:

```bash
K="sb_publishable_XZaNy8RC0iATbuq2IVJ0Qg_9qNDsMBd"; B="https://jtlblbgxzbxjplamdpiu.supabase.co"; echo "Mandanten:"; curl -s "$B/rest/v1/mandanten?select=id,vorname,pin" -H "apikey: $K" -H "Authorization: Bearer $K"; echo; echo "Daten:"; curl -s "$B/rest/v1/mandant_data?select=mandant_id" -H "apikey: $K" -H "Authorization: Bearer $K"; echo; echo "Dateien:"; curl -s -X POST "$B/storage/v1/object/list/mandant-files" -H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json" -d '{"prefix":"","limit":5}'
```

Danach unbedingt **einmal als Mandant testen**: eigenen Test-Link auf dem Handy
öffnen, PIN eingeben, ein Foto hochladen, einen Schritt der Selbstauskunft
ausfüllen und wieder herunterladen. Erst dann ist die Umstellung fertig.

---

## Was danach noch offen bleibt

- **Die PIN ist 5-stellig.** Gegen Massen-Durchprobieren schützt jetzt die
  Sperre aus Schritt 1. Wer aber sowohl den Link als auch die PIN hat, kommt
  rein — Link und PIN deshalb möglichst über **zwei verschiedene Wege**
  verschicken (z. B. Link per Mail, PIN per Telefon oder SMS).
- **Die Dateien liegen unverschlüsselt bei Supabase.** Sie sind jetzt nur noch
  für Berater und den jeweiligen Mandanten zugänglich, Supabase selbst könnte
  sie technisch lesen. Für echte Ende-zu-Ende-Verschlüsselung müsste im Browser
  ver- und entschlüsselt werden — das ist ein eigenes Projekt und würde
  bedeuten, dass verlorene Schlüssel die Dateien unrettbar machen.
- **`ADMIN_PASSWORD` in `src/App.jsx`** ist toter Code aus einer früheren
  Version und wird nirgends mehr benutzt — der echte Berater-Login läuft über
  Supabase-Auth. Kann bei Gelegenheit raus.
