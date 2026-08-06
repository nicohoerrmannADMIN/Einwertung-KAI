// ============================================================================
//  mandant-file — sicherer Datei-Zugang fuer die Mandantenseite
//
//  Die Mandantenseite darf NICHT mehr direkt auf den Storage zugreifen.
//  Stattdessen fragt sie hier an. Diese Funktion prueft Mandanten-ID + PIN
//  und gibt dann einen kurzlebigen Einmal-Link zurueck, der nur fuer den
//  eigenen Ordner des Mandanten gilt.
//
//  Deployen: siehe SICHERHEIT.md (Schritt 2)
//  WICHTIG: "Verify JWT" fuer diese Funktion AUSschalten — die Funktion
//  macht ihre eigene Pruefung ueber die PIN.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET       = "mandant-files";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "method not allowed" }, 405);

  try {
    const { mandant_id, pin, action, path } = await req.json();

    if (!mandant_id || !pin || !action || !path) {
      return json({ error: "bad request" }, 400);
    }

    // Der Pfad MUSS im eigenen Ordner liegen — sonst koennte ein Mandant
    // mit gueltiger PIN die Dateien eines anderen Mandanten abgreifen.
    if (!String(path).startsWith(`${mandant_id}/`) || String(path).includes("..")) {
      return json({ error: "forbidden" }, 403);
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // PIN pruefen
    const { data: m, error: mErr } = await sb
      .from("mandanten")
      .select("pin")
      .eq("id", mandant_id)
      .maybeSingle();

    if (mErr)  return json({ error: "lookup failed" }, 500);
    if (!m || String(m.pin) !== String(pin)) {
      return json({ error: "unauthorized" }, 401);
    }

    if (action === "upload") {
      const { data, error } = await sb.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (error) return json({ error: error.message }, 500);
      return json({ signedUrl: data.signedUrl, token: data.token });
    }

    if (action === "download") {
      // 5 Minuten gueltig
      const { data, error } = await sb.storage
        .from(BUCKET)
        .createSignedUrl(path, 300);
      if (error) return json({ error: error.message }, 500);
      return json({ signedUrl: data.signedUrl });
    }

    if (action === "delete") {
      const { error } = await sb.storage.from(BUCKET).remove([path]);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
