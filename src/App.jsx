import { useState, useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID = "875796881160-8vjs3un1i373mgm1b39rqle53qv3hmbu.apps.googleusercontent.com";
const ADMIN_PASSWORD = "ks2admin2025";
const FOLDER_NAME = "KS2-Mandanten";

// ── Storage ────────────────────────────────────────────────────────
async function loadMandanten() {
  try { const r = localStorage.getItem("mandanten"); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
async function saveMandanten(data) { localStorage.setItem("mandanten", JSON.stringify(data)); }
async function loadMandantData(id) {
  try { const r = localStorage.getItem(`mandant_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function saveMandantData(id, data) { localStorage.setItem(`mandant_${id}`, JSON.stringify(data)); }

// ── Utils ──────────────────────────────────────────────────────────
function generateId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function generateLink(id) { return `${window.location.origin}${window.location.pathname}?mandant=${id}`; }
function getMandantIdFromUrl() { return new URLSearchParams(window.location.search).get("mandant"); }

// ── Google Drive ───────────────────────────────────────────────────
function loadGoogleScript() {
  return new Promise((resolve) => {
    if (window.google) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = resolve;
    document.head.appendChild(s);
  });
}
async function getAccessToken() {
  await loadGoogleScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp) => { if (resp.error) reject(resp.error); else resolve(resp.access_token); },
    });
    client.requestAccessToken();
  });
}
async function ensureFolder(token, folderName, parentId = null) {
  const query = parentId
    ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;
  const meta = { name: folderName, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) };
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(meta) });
  const created = await createRes.json();
  return created.id;
}
async function uploadFileToDrive(token, file, folderId) {
  const meta = JSON.stringify({ name: file.name, parents: [folderId] });
  const form = new FormData();
  form.append("metadata", new Blob([meta], { type: "application/json" }));
  form.append("file", file);
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
}
async function uploadTextToDrive(token, filename, content, folderId) {
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const form = new FormData();
  form.append("metadata", new Blob([meta], { type: "application/json" }));
  form.append("file", new Blob([content], { type: "text/plain" }));
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
}

// ── CRM Parser ─────────────────────────────────────────────────────
function parseCRMText(text) {
  const get = (label) => {
    const regex = new RegExp(`${label}\\s+([^\\n]+)`, 'i');
    const m = text.match(regex);
    return m ? m[1].trim() : "";
  };
  const adresseRaw = get("Adresse");
  const adresseLines = adresseRaw.split(/\s{2,}|\n/);
  return {
    kundennummer: get("Kunde"),
    vorname: get("Vorname"),
    nachname: get("Nachname"),
    geburtsdatum: get("Geburtsdatum"),
    adresse: adresseLines[0] || adresseRaw,
    plz_ort: adresseLines[1] || "",
    telefon: text.match(/\+49[\s\d]+/)?.[0]?.trim() || "",
    email: text.match(/[\w.]+@[\w.]+/)?.[0] || "",
    familienstand: get("Familienstand"),
    staatsangehoerigkeit: get("Staatsangehörigkeit"),
    beruf: get("Ausgeübte Tätigkeit"),
  };
}

// ── Dokument Kategorien ────────────────────────────────────────────
const DOKUMENT_KATEGORIEN = [
  { id: "personalausweis", label: "Personalausweis", sublabel: "Vorder- & Rückseite", required: true },
  { id: "lohn1", label: "Lohnabrechnung", sublabel: "Letzter Monat", required: true },
  { id: "lohn2", label: "Lohnabrechnung", sublabel: "Vorletzter Monat", required: true },
  { id: "lohn3", label: "Lohnabrechnung", sublabel: "Drittletzter Monat", required: true },
  { id: "eigenkapital", label: "Eigenkapitalnachweis", sublabel: "mind. 30.000 €", required: true },
  { id: "schufa", label: "SCHUFA-Auskunft", sublabel: "Nicht älter als 3 Monate", required: false },
  { id: "sonstiges", label: "Sonstige Unterlagen", sublabel: "Optional", required: false },
];

// ── SA Felder (nur was Mandant ausfüllen muss) ────────────────────
const SA_SECTIONS = [
  {
    title: "Beruf & Beschäftigung",
    fields: [
      { key: "berufsstatus", label: "Berufsstatus", type: "select", options: ["Angestellter", "Arbeiter", "Rentner", "öffentlicher Dienst", "Beamter", "arbeitslos", "selbstständig"] },
      { key: "arbeitszeit", label: "Arbeitszeit", type: "select", options: ["Vollzeit", "Teilzeit"] },
      { key: "berufsbezeichnung", label: "Berufsbezeichnung", type: "text", placeholder: "z.B. Kaufmann" },
      { key: "arbeitgeber", label: "Derzeitiger Arbeitgeber", type: "text", placeholder: "Firmenname" },
      { key: "beschaeftigt_seit", label: "Beschäftigt seit (MM/JJJJ)", type: "text", placeholder: "01/2020" },
      { key: "arbeitsverhaeltnis", label: "Arbeitsverhältnis", type: "select", options: ["unbefristet", "befristet"] },
      { key: "probezeit", label: "In Probezeit?", type: "select", options: ["nein", "ja"] },
      { key: "selbststaendig_seit", label: "Selbstständig tätig seit", type: "text", placeholder: "MM/JJJJ (falls selbstständig)" },
    ]
  },
  {
    title: "Familie",
    fields: [
      { key: "familienstand", label: "Familienstand", type: "select", options: ["ledig", "verheiratet", "geschieden", "verwitwet", "getrennt lebend", "Lebensgemeinschaft"] },
      { key: "gueterstand", label: "Güterstand", type: "select", options: ["gesetzlicher Güterstand", "Gütertrennung", "Gütergemeinschaft"] },
      { key: "kinder_anzahl", label: "Anzahl unterhaltsberechtigte Kinder", type: "text", placeholder: "0" },
      { key: "kind1", label: "Kind 1 (Vorname Name, Geburtsdatum)", type: "text", placeholder: "Max Muster, 01.01.2010" },
      { key: "kind2", label: "Kind 2", type: "text", placeholder: "" },
    ]
  },
  {
    title: "Monatliches Einkommen (€)",
    fields: [
      { key: "eink_lohn", label: "Lohn/Gehalt netto", type: "text", placeholder: "3.500" },
      { key: "eink_anzahl_monatsgehaelter", label: "Anzahl Monatsgehälter", type: "text", placeholder: "12" },
      { key: "eink_partner", label: "Partner (Ehegatte) netto", type: "text", placeholder: "0" },
      { key: "eink_kindergeld", label: "Gesetzliches Kindergeld", type: "text", placeholder: "0" },
      { key: "eink_unterhalt_ehegatte", label: "Unterhalt von Ehegatten", type: "text", placeholder: "0" },
      { key: "eink_unterhalt_kinder", label: "Unterhalt von Kindern", type: "text", placeholder: "0" },
      { key: "eink_selbststaendig", label: "Aus selbstständiger Tätigkeit", type: "text", placeholder: "0" },
      { key: "eink_miete", label: "Mieteinnahmen (kalt)", type: "text", placeholder: "0" },
      { key: "eink_kapital", label: "Kapitaleinkünfte", type: "text", placeholder: "0" },
      { key: "eink_rente", label: "Renten / Pensionen", type: "text", placeholder: "0" },
      { key: "eink_sonstige", label: "Sonstige Einnahmen", type: "text", placeholder: "0" },
    ]
  },
  {
    title: "Monatliche Ausgaben (€)",
    fields: [
      { key: "ausg_miete", label: "Miete (entfällt künftig?)", type: "text", placeholder: "850" },
      { key: "ausg_nebenkosten", label: "Nebenkosten", type: "text", placeholder: "200" },
      { key: "ausg_versicherungen", label: "LV/RV/Bausparverträge", type: "text", placeholder: "350" },
      { key: "ausg_darlehen", label: "Darlehen mit Grundpfandrechten", type: "text", placeholder: "0" },
      { key: "ausg_raten", label: "Sonstige Ratenverpflichtungen", type: "text", placeholder: "0" },
      { key: "ausg_altersvorsorge", label: "Altersvorsorge (Selbstständige)", type: "text", placeholder: "0" },
      { key: "ausg_pkv", label: "Private Krankenversicherung", type: "text", placeholder: "677" },
      { key: "ausg_unterhalt", label: "Unterhaltszahlungen", type: "text", placeholder: "0" },
      { key: "ausg_sonstige", label: "Sonstige Ausgaben", type: "text", placeholder: "0" },
    ]
  },
  {
    title: "Rentenansprüche (monatlich, €)",
    fields: [
      { key: "rente_gesetzlich", label: "Rentenansprüche gesetzlich", type: "text", placeholder: "0" },
      { key: "rente_privat", label: "Rentenansprüche aus privaten LV/RV", type: "text", placeholder: "0" },
    ]
  },
  {
    title: "Vermögen (€)",
    fields: [
      { key: "verm_immobilien", label: "Haus- und Grundvermögen (Verkehrswert)", type: "text", placeholder: "0" },
      { key: "verm_bank", label: "Bank- und Sparguthaben", type: "text", placeholder: "0" },
      { key: "verm_bank_einsetzen", label: "Davon einsetzen", type: "text", placeholder: "0" },
      { key: "verm_wertpapiere", label: "Wertpapiere (Kurswert)", type: "text", placeholder: "0" },
      { key: "verm_bausparer", label: "Bausparvertrag", type: "text", placeholder: "0" },
      { key: "verm_versicherung", label: "Versicherungsanspruch (Rückkaufswert)", type: "text", placeholder: "0" },
      { key: "verm_sonstiges", label: "Sonstiges Vermögen", type: "text", placeholder: "0" },
    ]
  },
  {
    title: "Verbindlichkeiten (€)",
    fields: [
      { key: "verb_hypotheken", label: "Hypotheken / Grundschulden (Restschuld)", type: "text", placeholder: "0" },
      { key: "verb_kredite", label: "Bank- / Privatkredite", type: "text", placeholder: "0" },
      { key: "verb_sonstige", label: "Sonstige Verbindlichkeiten", type: "text", placeholder: "0" },
      { key: "verb_buergschaften", label: "Übernommene Bürgschaften", type: "text", placeholder: "0" },
    ]
  },
  {
    title: "Bankverbindung",
    fields: [
      { key: "iban", label: "IBAN", type: "text", placeholder: "DE00 0000 0000 0000 0000 00" },
      { key: "bic", label: "BIC", type: "text", placeholder: "XXXXXXXX" },
      { key: "bank_seit", label: "Bankverbindung seit", type: "text", placeholder: "MM/JJJJ" },
    ]
  },
];

// ── CSS ────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0f0e0c; --paper: #f5f2ed; --cream: #ede9e2;
    --accent: #c8401a; --accent-light: #f0e8e3; --muted: #8a8680;
    --line: #d4cfc7; --success: #2d6a4f; --success-bg: #e8f4ef; --radius: 2px;
  }
  body { background: var(--paper); color: var(--ink); font-family: 'DM Mono', monospace; font-size: 13px; min-height: 100vh; }
  .app { max-width: 720px; margin: 0 auto; padding: 48px 24px; }
  .header { margin-bottom: 40px; border-bottom: 1px solid var(--ink); padding-bottom: 20px; }
  .header-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .header-title { font-family: 'DM Serif Display', serif; font-size: 32px; line-height: 1.1; }
  .header-title em { font-style: italic; color: var(--accent); }
  .panel { background: var(--cream); border: 1px solid var(--line); padding: 24px; margin-bottom: 20px; }
  .section-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
  .input-row { display: flex; gap: 8px; }
  .input-field { flex: 1; padding: 10px 14px; border: 1px solid var(--line); background: var(--paper); font-family: 'DM Mono', monospace; font-size: 13px; color: var(--ink); outline: none; border-radius: var(--radius); }
  .input-field:focus { border-color: var(--ink); }
  .btn { padding: 10px 20px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.05em; cursor: pointer; border-radius: var(--radius); transition: all 0.15s; white-space: nowrap; }
  .btn:hover { background: var(--accent); border-color: var(--accent); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-outline { background: transparent; color: var(--ink); }
  .btn-outline:hover { background: var(--ink); color: var(--paper); }
  .btn-sm { padding: 6px 12px; font-size: 11px; }
  .btn-danger { border-color: var(--accent); color: var(--accent); background: transparent; }
  .btn-danger:hover { background: var(--accent); color: var(--paper); }
  .btn-success { background: var(--success); border-color: var(--success); }
  .mandant-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
  .mandant-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 16px; background: var(--paper); border: 1px solid var(--line); gap: 12px; flex-wrap: wrap; }
  .mandant-name { font-weight: 500; font-size: 14px; }
  .mandant-progress { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .mandant-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .link-display { font-size: 10px; color: var(--muted); word-break: break-all; margin-top: 4px; }
  .uploads-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 28px; }
  .upload-item { border: 1px solid var(--line); background: var(--paper); }
  .upload-item.completed { border-color: var(--success); background: var(--success-bg); }
  .upload-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; gap: 12px; flex-wrap: wrap; }
  .upload-label-row { display: flex; align-items: center; gap: 10px; }
  .upload-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); flex-shrink: 0; }
  .upload-item.completed .upload-status-dot { background: var(--success); }
  .upload-label { font-weight: 500; font-size: 12px; }
  .upload-sublabel { font-size: 10px; color: var(--muted); margin-top: 1px; }
  .upload-files-list { padding: 0 16px 10px 34px; display: flex; flex-direction: column; gap: 3px; }
  .upload-file-item { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--muted); padding: 3px 0; border-top: 1px solid var(--line); }
  .file-input { display: none; }
  .sa-section { border: 1px solid var(--line); margin-bottom: 12px; }
  .sa-section-header { padding: 12px 16px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; background: var(--cream); cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .sa-section-body { padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .form-group { display: flex; flex-direction: column; gap: 4px; }
  .form-group.full { grid-column: 1/-1; }
  .form-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .form-input { padding: 8px 10px; border: 1px solid var(--line); background: var(--paper); font-family: 'DM Mono', monospace; font-size: 12px; color: var(--ink); outline: none; border-radius: var(--radius); }
  .form-input:focus { border-color: var(--ink); }
  .form-input.prefilled { background: #f0f8f0; border-color: var(--success); color: var(--success); }
  .progress-wrap { margin-bottom: 24px; }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; color: var(--muted); }
  .progress-bar { height: 3px; background: var(--line); }
  .progress-fill { height: 100%; background: var(--ink); transition: width 0.4s ease; }
  .final-section { border: 1px solid var(--ink); padding: 24px; background: var(--cream); }
  .final-section.disabled { opacity: 0.4; pointer-events: none; }
  .sign-pad-wrap { border: 1px solid var(--line); background: white; position: relative; margin: 12px 0; }
  .sign-pad { display: block; cursor: crosshair; touch-action: none; }
  .sign-label { font-size: 10px; color: var(--muted); padding: 6px 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--ink); color: var(--paper); padding: 12px 18px; font-size: 12px; z-index: 999; max-width: 300px; }
  .divider { height: 1px; background: var(--line); margin: 24px 0; }
  .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 3px 8px; border-radius: 99px; font-weight: 500; }
  .badge-success { background: var(--success-bg); color: var(--success); }
  .badge-info { background: var(--accent-light); color: var(--accent); }
  .crm-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .login-wrap { max-width: 380px; margin: 80px auto; padding: 0 24px; }
  .admin-tag { font-size: 10px; background: var(--ink); color: var(--paper); padding: 2px 6px; border-radius: 2px; margin-left: 8px; }
`;

// ── Toast ──────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

// ── Signature Pad ──────────────────────────────────────────────────
function SignaturePad({ onSave }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function start(e) {
    drawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  }
  function draw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#0f0e0c";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  }
  function stop() { drawing.current = false; }
  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }
  function save() { onSave(canvasRef.current.toDataURL()); }

  return (
    <div className="sign-pad-wrap">
      <canvas ref={canvasRef} className="sign-pad" width={500} height={120}
        onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      <div className="sign-label">
        <span>Hier unterschreiben</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={clear}>Löschen</button>
          <button className="btn btn-sm" onClick={save}>Unterschrift speichern ✓</button>
        </span>
      </div>
    </div>
  );
}

// ── SA Form ────────────────────────────────────────────────────────
function SelbstauskunftForm({ crmData, existing, onSave, onClose }) {
  const initial = {};
  SA_SECTIONS.forEach(s => s.fields.forEach(f => {
    initial[f.key] = existing?.[f.key] ?? crmData?.[f.key] ?? "";
  }));
  // Pre-fill from CRM
  if (crmData) {
    if (!initial.familienstand && crmData.familienstand) initial.familienstand = crmData.familienstand;
    if (!initial.iban && crmData.iban) initial.iban = crmData.iban;
    if (!initial.bic && crmData.bic) initial.bic = crmData.bic;
  }

  const [vals, setVals] = useState(initial);
  const [open, setOpen] = useState({ 0: true });
  const [sig, setSig] = useState(existing?.signature || null);
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  const crmKeys = Object.keys(crmData || {});

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,14,12,0.75)", overflowY: "auto", zIndex: 100, padding: "24px" }}>
      <div style={{ background: "var(--paper)", maxWidth: 640, margin: "0 auto", border: "1px solid var(--ink)", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div className="header-label">Dokument</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Selbstauskunft</div>
            {crmData && <div className="badge badge-success" style={{ marginTop: 6 }}>✓ CRM-Daten vorausgefüllt</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>

        {SA_SECTIONS.map((section, si) => (
          <div key={si} className="sa-section">
            <div className="sa-section-header" onClick={() => setOpen(p => ({ ...p, [si]: !p[si] }))}>
              <span>{section.title}</span>
              <span>{open[si] ? "▲" : "▼"}</span>
            </div>
            {open[si] && (
              <div className="sa-section-body">
                {section.fields.map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}</label>
                    {f.type === "select" ? (
                      <select className="form-input" value={vals[f.key]} onChange={e => set(f.key, e.target.value)}>
                        <option value="">– wählen –</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input className={`form-input${crmKeys.includes(f.key) && vals[f.key] ? " prefilled" : ""}`}
                        value={vals[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="divider" />
        <div className="section-label">Unterschrift des Kunden</div>
        {sig
          ? <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <img src={sig} alt="Unterschrift" style={{ border: "1px solid var(--line)", maxWidth: 240 }} />
              <button className="btn btn-outline btn-sm" onClick={() => setSig(null)}>Neu unterschreiben</button>
            </div>
          : <SignaturePad onSave={setSig} />
        }

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-sm" onClick={() => onSave({ ...vals, signature: sig })}>Speichern ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Mandant Page ───────────────────────────────────────────────────
function MandantPage({ mandantId }) {
  const [data, setData] = useState(null);
  const [showSA, setShowSA] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadMandantData(mandantId).then(d => { if (d) setData(d); }); }, [mandantId]);

  if (!data) return <div className="app"><style>{CSS}</style><div style={{ color: "var(--muted)", paddingTop: 48 }}>Lade…</div></div>;

  const { vorname, nachname, uploads = {}, selbstauskunft = null, crmData = null } = data;
  const fullName = `${vorname} ${nachname}`;
  const reqDocs = DOKUMENT_KATEGORIEN.filter(d => d.required);
  const doneReq = reqDocs.filter(d => (uploads[d.id]?.length ?? 0) > 0).length;
  const totalSteps = reqDocs.length + 1;
  const doneSteps = doneReq + (selbstauskunft ? 1 : 0);
  const pct = Math.round((doneSteps / totalSteps) * 100);
  const allDone = doneSteps === totalSteps;

  async function handleUpload(docId, files) {
    const fileList = Array.from(files).map(f => ({ name: f.name, date: new Date().toLocaleDateString("de-DE"), _file: f }));
    const newUploads = { ...uploads, [docId]: [...(uploads[docId] ?? []), ...fileList] };
    const newData = { ...data, uploads: newUploads };
    setData(newData);
    await saveMandantData(mandantId, newData);
    setToast(`${fileList.length} Datei(en) gespeichert`);
  }

  async function handleRemoveFile(docId, idx) {
    const newList = uploads[docId].filter((_, i) => i !== idx);
    const newData = { ...data, uploads: { ...uploads, [docId]: newList } };
    setData(newData);
    await saveMandantData(mandantId, newData);
  }

  async function handleSaveSA(vals) {
    const newData = { ...data, selbstauskunft: vals };
    setData(newData);
    await saveMandantData(mandantId, newData);
    setShowSA(false);
    setToast("Selbstauskunft gespeichert ✓");
  }

  async function handleSyncDrive() {
    setUploading(true);
    try {
      const token = await getAccessToken();
      const rootId = await ensureFolder(token, FOLDER_NAME);
      const folderId = await ensureFolder(token, fullName, rootId);
      for (const [, files] of Object.entries(uploads)) {
        for (const file of files) {
          if (file._file) await uploadFileToDrive(token, file._file, folderId);
        }
      }
      if (selbstauskunft) {
        const saText = Object.entries(selbstauskunft).map(([k, v]) => `${k}: ${v}`).join("\n");
        await uploadTextToDrive(token, `Selbstauskunft_${fullName}.txt`, saText, folderId);
      }
      setToast(`✓ In Google Drive gespeichert`);
    } catch (e) {
      setToast("Fehler – bitte erneut versuchen");
    }
    setUploading(false);
  }

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="header">
        <div className="header-label">Meine Unterlagen für den Einwertungsprozess</div>
        <div className="header-title"><em>{fullName}</em></div>
        {crmData && <div className="badge badge-success" style={{ marginTop: 8 }}>✓ Ihre Daten wurden vorausgefüllt</div>}
      </div>

      <div className="progress-wrap">
        <div className="progress-header"><span>Fortschritt</span><span>{doneSteps} / {totalSteps}</span></div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="section-label">Unterlagen hochladen</div>
      <div className="uploads-grid">
        {DOKUMENT_KATEGORIEN.map(dok => {
          const files = uploads[dok.id] ?? [];
          const done = files.length > 0;
          return (
            <div key={dok.id} className={`upload-item${done ? " completed" : ""}`}>
              <div className="upload-header">
                <div className="upload-label-row">
                  <div className="upload-status-dot" />
                  <div>
                    <div className="upload-label">{dok.label}{dok.required && <span style={{ color: "var(--accent)", marginLeft: 4 }}>*</span>}</div>
                    <div className="upload-sublabel">{dok.sublabel}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {done && <span className="badge badge-success">✓ {files.length}</span>}
                  <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                    Hochladen
                    <input type="file" className="file-input" multiple accept="image/*,application/pdf" capture="environment" onChange={e => handleUpload(dok.id, e.target.files)} />
                  </label>
                </div>
              </div>
              {files.length > 0 && (
                <div className="upload-files-list">
                  {files.map((f, i) => (
                    <div key={i} className="upload-file-item">
                      <span>📄 {f.name}</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveFile(dok.id, i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="divider" />

      <div className={`panel${selbstauskunft ? "" : ""}`} style={{ borderColor: selbstauskunft ? "var(--success)" : "var(--line)", background: selbstauskunft ? "var(--success-bg)" : "var(--cream)" }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 4 }}>Selbstauskunft</div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 16 }}>
          {selbstauskunft ? "Ausgefüllt und gespeichert." : "Bitte alle relevanten Felder ausfüllen."}
          {crmData && !selbstauskunft && " Ihre bekannten Daten sind bereits vorausgefüllt."}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selbstauskunft && <span className="badge badge-success">✓ Ausgefüllt</span>}
          {selbstauskunft?.signature && <span className="badge badge-success">✓ Unterschrift</span>}
          <button className="btn btn-outline btn-sm" onClick={() => setShowSA(true)}>
            {selbstauskunft ? "Bearbeiten" : "Ausfüllen →"}
          </button>
        </div>
      </div>

      <div className="divider" />

      <div className={`final-section${!allDone ? " disabled" : ""}`}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 8 }}>Unterlagen einreichen</div>
        <div style={{ color: "var(--muted)", fontSize: 11, marginBottom: 16 }}>
          {allDone ? "Alle Unterlagen vollständig. Jetzt in Google Drive hochladen." : "Bitte erst alle Pflichtfelder ausfüllen."}
        </div>
        <button className="btn btn-success" onClick={handleSyncDrive} disabled={uploading}>
          {uploading ? "Lädt hoch…" : "→ Google Drive speichern"}
        </button>
      </div>

      {showSA && <SelbstauskunftForm crmData={crmData} existing={selbstauskunft} onSave={handleSaveSA} onClose={() => setShowSA(false)} />}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// ── Admin Login ────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  function check() {
    if (pw === ADMIN_PASSWORD) { sessionStorage.setItem("ks2admin", "1"); onLogin(); }
    else { setErr(true); setTimeout(() => setErr(false), 2000); }
  }
  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="login-wrap">
        <div className="header-label">KS2 · Immobilien</div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 24 }}>Admin<br /><em style={{ fontStyle: "italic", color: "var(--accent)" }}>Zugang</em></div>
        <input className="input-field" type="password" placeholder="Passwort" value={pw}
          onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && check()}
          style={{ width: "100%", marginBottom: 8, borderColor: err ? "var(--accent)" : undefined }} />
        {err && <div style={{ color: "var(--accent)", fontSize: 11, marginBottom: 8 }}>Falsches Passwort</div>}
        <button className="btn" style={{ width: "100%" }} onClick={check}>Einloggen →</button>
      </div>
    </div>
  );
}

// ── Admin Page ─────────────────────────────────────────────────────
function AdminPage() {
  const [mandanten, setMandanten] = useState({});
  const [name, setName] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [details, setDetails] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [crmText, setCrmText] = useState("");

  useEffect(() => {
    loadMandanten().then(m => {
      setMandanten(m);
      Object.keys(m).forEach(id => {
        loadMandantData(id).then(d => { if (d) setDetails(p => ({ ...p, [id]: d })); });
      });
    });
  }, []);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parts = trimmed.split(" ");
    const id = generateId();
    const newM = { ...mandanten, [id]: { vorname: parts[0], nachname: parts.slice(1).join(" "), createdAt: new Date().toISOString() } };
    await saveMandanten(newM);
    await saveMandantData(id, { vorname: parts[0], nachname: parts.slice(1).join(" "), uploads: {}, selbstauskunft: null, crmData: null, adminData: {} });
    setMandanten(newM);
    setName("");
    setToast(`${trimmed} angelegt ✓`);
  }

  async function handleDelete(id) {
    const newM = { ...mandanten };
    delete newM[id];
    await saveMandanten(newM);
    setMandanten(newM);
  }

  function handleCopy(id) {
    navigator.clipboard.writeText(generateLink(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleCRMUpload(id, file) {
    const text = await file.text();
    const parsed = parseCRMText(text);
    const d = await loadMandantData(id);
    const newData = { ...d, crmData: parsed };
    await saveMandantData(id, newData);
    setDetails(p => ({ ...p, [id]: newData }));
    setToast("CRM-Daten importiert ✓");
  }

  async function handleAdminField(id, key, value) {
    const d = await loadMandantData(id);
    const newData = { ...d, adminData: { ...(d.adminData || {}), [key]: value } };
    await saveMandantData(id, newData);
    setDetails(p => ({ ...p, [id]: newData }));
  }

  function getProgress(id) {
    const d = details[id];
    if (!d) return "…";
    const req = DOKUMENT_KATEGORIEN.filter(x => x.required);
    const done = req.filter(x => (d.uploads?.[x.id]?.length ?? 0) > 0).length;
    return `${done + (d.selbstauskunft ? 1 : 0)} / ${req.length + 1}`;
  }

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="header">
        <div className="header-label">KS2 · Immobilien Einwertung</div>
        <div className="header-title">Mandanten<br /><em>verwalten</em></div>
      </div>

      <div className="panel">
        <div className="section-label">Neuen Mandanten anlegen</div>
        <div className="input-row">
          <input className="input-field" placeholder="Max Mustermann" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
          <button className="btn" onClick={handleCreate}>Anlegen →</button>
        </div>
      </div>

      {Object.keys(mandanten).length > 0 && (
        <>
          <div className="section-label">Aktive Mandanten</div>
          <div className="mandant-list">
            {Object.entries(mandanten).map(([id, m]) => {
              const d = details[id];
              const expanded = expandedId === id;
              return (
                <div key={id} style={{ border: "1px solid var(--line)", background: "var(--paper)" }}>
                  <div className="mandant-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="mandant-name">{m.vorname} {m.nachname}</div>
                        {d?.crmData && <span className="badge badge-success">CRM ✓</span>}
                        {d?.adminData?.perso_nr && <span className="badge badge-success">Perso ✓</span>}
                        {d?.adminData?.iban && <span className="badge badge-success">IBAN ✓</span>}
                      </div>
                      <div className="mandant-progress">{getProgress(id)} Schritte</div>
                      <div className="link-display">{generateLink(id)}</div>
                    </div>
                    <div className="mandant-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setExpandedId(expanded ? null : id)}>
                        {expanded ? "▲" : "▼ Details"}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleCopy(id)}>{copiedId === id ? "✓" : "Link"}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => window.open(generateLink(id), "_blank")}>Öffnen</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(id)}>×</button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ padding: "16px", borderTop: "1px solid var(--line)", background: "var(--cream)" }}>
                      <div className="section-label">CRM-Import</div>
                      <label className="btn btn-outline btn-sm" style={{ cursor: "pointer", display: "inline-block", marginBottom: 12 }}>
                        📂 CRM-Datei hochladen (.txt/.pdf)
                        <input type="file" className="file-input" accept=".txt,.pdf" onChange={e => handleCRMUpload(id, e.target.files[0])} />
                      </label>
                      {d?.crmData && (
                        <div style={{ fontSize: 11, color: "var(--success)", marginBottom: 12 }}>
                          ✓ {d.crmData.vorname} {d.crmData.nachname} · {d.crmData.geburtsdatum} · {d.crmData.email}
                        </div>
                      )}

                      <div className="section-label" style={{ marginTop: 12 }}>Personalausweis-Daten (von uns eingetragen)</div>
                      <div className="crm-fields">
                        {[
                          { key: "perso_nr", label: "Ausweis-Nr." },
                          { key: "perso_behoerde", label: "Ausstellungsbehörde" },
                          { key: "perso_datum", label: "Ausstellungsdatum" },
                          { key: "perso_gueltig", label: "Gültig bis" },
                          { key: "geburtsort", label: "Geburtsort" },
                          { key: "geburtsname", label: "Geburtsname" },
                          { key: "wohnhaft_seit", label: "Wohnhaft seit" },
                          { key: "iban", label: "IBAN" },
                          { key: "bic", label: "BIC" },
                          { key: "bank_seit", label: "Bankverbindung seit" },
                        ].map(f => (
                          <div key={f.key} className="form-group">
                            <label className="form-label">{f.label}</label>
                            <input className="form-input" value={d?.adminData?.[f.key] || ""}
                              onChange={e => handleAdminField(id, f.key, e.target.value)}
                              placeholder={f.label} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────
export default function App() {
  const mandantId = getMandantIdFromUrl();
  const [adminAuth, setAdminAuth] = useState(() => sessionStorage.getItem("ks2admin") === "1");
  if (mandantId) return <MandantPage mandantId={mandantId} />;
  if (!adminAuth) return <AdminLogin onLogin={() => setAdminAuth(true)} />;
  return <AdminPage />;
}
