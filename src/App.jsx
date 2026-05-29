import { useState, useEffect } from "react";

const GOOGLE_CLIENT_ID = "875796881160-8vjs3un1i373mgm1b39rqle53qv3hmbu.apps.googleusercontent.com";
const ADMIN_PASSWORD = "ks2admin2025";
const FOLDER_NAME = "KS2-Mandanten";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0f0e0c; --paper: #f5f2ed; --cream: #ede9e2;
    --accent: #c8401a; --accent-light: #f0e8e3; --muted: #8a8680;
    --line: #d4cfc7; --success: #2d6a4f; --success-bg: #e8f4ef; --radius: 2px;
  }
  body { background: var(--paper); color: var(--ink); font-family: 'DM Mono', monospace; font-size: 13px; min-height: 100vh; }
  .app { max-width: 680px; margin: 0 auto; padding: 48px 24px; }
  .header { margin-bottom: 48px; border-bottom: 1px solid var(--ink); padding-bottom: 20px; }
  .header-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
  .header-title { font-family: 'DM Serif Display', serif; font-size: 32px; line-height: 1.1; }
  .header-title em { font-style: italic; color: var(--accent); }
  .admin-panel { background: var(--cream); border: 1px solid var(--line); padding: 28px; margin-bottom: 32px; }
  .section-label { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 16px; }
  .input-row { display: flex; gap: 8px; }
  .input-field { flex: 1; padding: 10px 14px; border: 1px solid var(--line); background: var(--paper); font-family: 'DM Mono', monospace; font-size: 13px; color: var(--ink); outline: none; border-radius: var(--radius); transition: border-color 0.15s; }
  .input-field:focus { border-color: var(--ink); }
  .btn { padding: 10px 20px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); font-family: 'DM Mono', monospace; font-size: 12px; letter-spacing: 0.05em; cursor: pointer; border-radius: var(--radius); transition: all 0.15s; white-space: nowrap; }
  .btn:hover { background: var(--accent); border-color: var(--accent); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-outline { background: transparent; color: var(--ink); }
  .btn-outline:hover { background: var(--ink); color: var(--paper); }
  .btn-sm { padding: 6px 12px; font-size: 11px; }
  .btn-danger { border-color: var(--accent); color: var(--accent); background: transparent; }
  .btn-danger:hover { background: var(--accent); color: var(--paper); }
  .btn-success { background: var(--success); border-color: var(--success); }
  .mandant-list { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
  .mandant-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--paper); border: 1px solid var(--line); gap: 12px; flex-wrap: wrap; }
  .mandant-name { font-weight: 500; }
  .mandant-progress { font-size: 11px; color: var(--muted); }
  .mandant-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .link-display { font-size: 10px; color: var(--muted); word-break: break-all; margin-top: 4px; }
  .uploads-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 36px; }
  .upload-item { border: 1px solid var(--line); background: var(--paper); transition: border-color 0.15s; }
  .upload-item.completed { border-color: var(--success); background: var(--success-bg); }
  .upload-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; gap: 12px; flex-wrap: wrap; }
  .upload-label-row { display: flex; align-items: center; gap: 10px; }
  .upload-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); flex-shrink: 0; transition: background 0.2s; }
  .upload-item.completed .upload-status-dot { background: var(--success); }
  .upload-label { font-weight: 500; font-size: 12px; }
  .upload-sublabel { font-size: 10px; color: var(--muted); margin-top: 2px; }
  .upload-actions { display: flex; gap: 6px; align-items: center; }
  .upload-files-list { padding: 0 16px 12px 34px; display: flex; flex-direction: column; gap: 4px; }
  .upload-file-item { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--muted); padding: 4px 0; border-top: 1px solid var(--line); }
  .upload-file-name { display: flex; align-items: center; gap: 6px; }
  .file-input { display: none; }
  .selbstauskunft-section { border: 1px solid var(--line); padding: 24px; margin-bottom: 32px; }
  .selbstauskunft-section.completed { border-color: var(--success); background: var(--success-bg); }
  .section-title { font-family: 'DM Serif Display', serif; font-size: 20px; margin-bottom: 4px; }
  .section-desc { color: var(--muted); font-size: 11px; margin-bottom: 20px; }
  .form-overlay { position: fixed; inset: 0; background: rgba(15,14,12,0.7); display: flex; align-items: flex-start; justify-content: center; padding: 24px; z-index: 100; overflow-y: auto; }
  .form-modal { background: var(--paper); width: 100%; max-width: 600px; border: 1px solid var(--ink); padding: 32px; animation: slideIn 0.2s ease; }
  @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  .form-modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .form-modal-title { font-family: 'DM Serif Display', serif; font-size: 22px; }
  .close-btn { background: none; border: none; cursor: pointer; font-size: 20px; color: var(--muted); padding: 0; line-height: 1; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .form-group { display: flex; flex-direction: column; gap: 5px; }
  .form-label { font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .form-input { padding: 9px 12px; border: 1px solid var(--line); background: var(--paper); font-family: 'DM Mono', monospace; font-size: 12px; color: var(--ink); outline: none; border-radius: var(--radius); transition: border-color 0.15s; }
  .form-input:focus { border-color: var(--ink); }
  .form-section-divider { font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); padding: 12px 0 4px; border-top: 1px solid var(--line); grid-column: 1 / -1; margin-top: 8px; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .progress-wrap { margin-bottom: 32px; }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; color: var(--muted); }
  .progress-bar { height: 3px; background: var(--line); }
  .progress-fill { height: 100%; background: var(--ink); transition: width 0.4s ease; }
  .final-section { border: 1px solid var(--ink); padding: 24px; background: var(--cream); }
  .final-section.disabled { opacity: 0.4; pointer-events: none; }
  .final-title { font-family: 'DM Serif Display', serif; font-size: 18px; margin-bottom: 8px; }
  .final-desc { color: var(--muted); font-size: 11px; margin-bottom: 16px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--ink); color: var(--paper); padding: 12px 18px; font-size: 12px; z-index: 999; animation: toastIn 0.2s ease; max-width: 300px; }
  @keyframes toastIn { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
  .divider { height: 1px; background: var(--line); margin: 32px 0; }
  .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 3px 8px; border-radius: 99px; font-weight: 500; }
  .badge-success { background: var(--success-bg); color: var(--success); }
  .badge-pending { background: var(--accent-light); color: var(--accent); }
  .login-wrap { max-width: 380px; margin: 80px auto; padding: 0 24px; }
  .login-title { font-family: 'DM Serif Display', serif; font-size: 28px; margin-bottom: 24px; }
  .gdrive-btn { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border: 1px solid var(--line); background: var(--paper); cursor: pointer; font-family: 'DM Mono', monospace; font-size: 13px; color: var(--ink); border-radius: var(--radius); width: 100%; margin-top: 12px; transition: border-color 0.15s; }
  .gdrive-btn:hover { border-color: var(--ink); }
  .gdrive-icon { width: 20px; height: 20px; }
  .status-bar { background: var(--success-bg); border: 1px solid var(--success); padding: 10px 16px; font-size: 11px; color: var(--success); margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
`;

const DOKUMENT_KATEGORIEN = [
  { id: "lohn1", label: "Lohnabrechnung", sublabel: "Letzter Monat", required: true },
  { id: "lohn2", label: "Lohnabrechnung", sublabel: "Vorletzter Monat", required: true },
  { id: "lohn3", label: "Lohnabrechnung", sublabel: "Drittletzter Monat", required: true },
  { id: "eigenkapital", label: "Eigenkapitalnachweis", sublabel: "mind. 30.000 €", required: true },
  { id: "schufa", label: "SCHUFA-Auskunft", sublabel: "Nicht älter als 3 Monate", required: false },
  { id: "sonstiges", label: "Sonstige Unterlagen", sublabel: "Optional", required: false },
];

const SA_FELDER = {
  "Persönliche Daten": [
    { key: "vorname", label: "Vorname", placeholder: "Max", full: false },
    { key: "nachname", label: "Nachname", placeholder: "Mustermann", full: false },
    { key: "geburtsdatum", label: "Geburtsdatum", placeholder: "01.01.1985", full: false },
    { key: "geburtsort", label: "Geburtsort", placeholder: "Berlin", full: false },
    { key: "staatsangehoerigkeit", label: "Staatsangehörigkeit", placeholder: "Deutsch", full: false },
    { key: "familienstand", label: "Familienstand", placeholder: "Verheiratet", full: false },
    { key: "adresse", label: "Aktuelle Adresse", placeholder: "Musterstraße 1, 10115 Berlin", full: true },
    { key: "telefon", label: "Telefon", placeholder: "+49 170 1234567", full: false },
    { key: "email", label: "E-Mail", placeholder: "max@beispiel.de", full: false },
  ],
  "Beschäftigung & Einkommen": [
    { key: "arbeitgeber", label: "Arbeitgeber", placeholder: "Musterfirma GmbH", full: false },
    { key: "berufsbezeichnung", label: "Berufsbezeichnung", placeholder: "Kaufmann/-frau", full: false },
    { key: "beschaeftigt_seit", label: "Beschäftigt seit", placeholder: "01.2020", full: false },
    { key: "beschaeftigungsart", label: "Beschäftigungsart", placeholder: "Vollzeit, unbefristet", full: false },
    { key: "nettoeinkommen", label: "Nettoeinkommen monatlich", placeholder: "3.500 €", full: false },
    { key: "sonstige_einnahmen", label: "Sonstige Einnahmen", placeholder: "Mieteinnahmen 500 €", full: false },
  ],
  "Vermögen & Verbindlichkeiten": [
    { key: "eigenkapital_betrag", label: "Eigenkapital vorhanden", placeholder: "35.000 €", full: false },
    { key: "eigenkapital_herkunft", label: "Herkunft Eigenkapital", placeholder: "Ersparnisse", full: false },
    { key: "bestehende_kredite", label: "Bestehende Kredite", placeholder: "Autokredit 180 €/Monat", full: false },
    { key: "monatliche_belastungen", label: "Monatl. Gesamtbelastungen", placeholder: "350 €", full: false },
    { key: "immobilien_vorhanden", label: "Bereits Immobilien vorhanden", placeholder: "Nein", full: false },
    { key: "schufa_eintraege", label: "Negative SCHUFA-Einträge", placeholder: "Keine", full: false },
  ],
  "Kaufvorhaben": [
    { key: "kaufpreis_budget", label: "Kaufpreis / Budget", placeholder: "350.000 €", full: false },
    { key: "objektart", label: "Objektart", placeholder: "Eigentumswohnung", full: false },
    { key: "region", label: "Gewünschte Region", placeholder: "München", full: false },
    { key: "nutzungsart", label: "Nutzungsart", placeholder: "Eigennutzung / Kapitalanlage", full: false },
    { key: "kaufzeitpunkt", label: "Geplanter Kaufzeitpunkt", placeholder: "Q3 2025", full: false },
    { key: "bemerkungen", label: "Weitere Bemerkungen", placeholder: "...", full: true },
  ],
};

function generateId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function generateLink(id) { return `${window.location.origin}${window.location.pathname}?mandant=${id}`; }
function getMandantIdFromUrl() { return new URLSearchParams(window.location.search).get("mandant"); }

async function loadMandanten() {
  try { const r = localStorage.getItem("mandanten"); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
async function saveMandanten(data) { localStorage.setItem("mandanten", JSON.stringify(data)); }
async function loadMandantData(id) {
  try { const r = localStorage.getItem(`mandant_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function saveMandantData(id, data) { localStorage.setItem(`mandant_${id}`, JSON.stringify(data)); }

// ── Google Drive API ──────────────────────────────────────────────
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
      callback: (resp) => {
        if (resp.error) reject(resp.error);
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

async function ensureFolder(token, folderName, parentId = null) {
  const query = parentId
    ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.files && data.files.length > 0) return data.files[0].id;
  const meta = { name: folderName, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) };
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  const created = await createRes.json();
  return created.id;
}

async function uploadFileToDrive(token, file, folderId) {
  const meta = JSON.stringify({ name: file.name, parents: [folderId] });
  const form = new FormData();
  form.append("metadata", new Blob([meta], { type: "application/json" }));
  form.append("file", file);
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
  });
}

async function uploadToGoogleDrive(mandantName, filesByCategory) {
  const token = await getAccessToken();
  const rootId = await ensureFolder(token, FOLDER_NAME);
  const mandantId = await ensureFolder(token, mandantName, rootId);
  for (const [, files] of Object.entries(filesByCategory)) {
    for (const file of files) {
      if (file._file) await uploadFileToDrive(token, file._file, mandantId);
    }
  }
  return mandantId;
}

// ── Toast ──────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

// ── Selbstauskunft Modal ───────────────────────────────────────────
function SelbstauskunftModal({ vorname, nachname, existing, onSave, onClose }) {
  const initial = {};
  Object.values(SA_FELDER).flat().forEach(f => { initial[f.key] = existing?.[f.key] ?? ""; });
  if (!existing?.vorname && vorname) initial.vorname = vorname;
  if (!existing?.nachname && nachname) initial.nachname = nachname;
  const [vals, setVals] = useState(initial);
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));
  return (
    <div className="form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="form-modal">
        <div className="form-modal-header">
          <div><div className="header-label">Dokument</div><div className="form-modal-title">Selbstauskunft</div></div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {Object.entries(SA_FELDER).map(([section, felder]) => (
          <div key={section}>
            <div className="form-grid">
              <div className="form-section-divider">{section}</div>
              {felder.map(f => (
                <div key={f.key} className="form-group" style={f.full ? { gridColumn: "1/-1" } : {}}>
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" value={vals[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-sm" onClick={() => onSave(vals)}>Speichern ✓</button>
        </div>
      </div>
    </div>
  );
}

// ── Mandant Page ───────────────────────────────────────────────────
function MandantPage({ mandantId }) {
  const [data, setData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadMandantData(mandantId).then(d => { if (d) setData(d); }); }, [mandantId]);

  if (!data) return <div className="app"><style>{CSS}</style><div style={{ color: "var(--muted)", paddingTop: 48 }}>Lade…</div></div>;

  const { vorname, nachname, uploads = {}, selbstauskunft = null } = data;
  const fullName = `${vorname} ${nachname}`;
  const requiredDocs = DOKUMENT_KATEGORIEN.filter(d => d.required);
  const completedRequired = requiredDocs.filter(d => (uploads[d.id]?.length ?? 0) > 0).length;
  const totalSteps = requiredDocs.length + 1;
  const completedSteps = completedRequired + (selbstauskunft ? 1 : 0);
  const pct = Math.round((completedSteps / totalSteps) * 100);
  const allDone = completedSteps === totalSteps;

  async function handleUpload(docId, files) {
    const fileList = Array.from(files).map(f => ({ name: f.name, size: f.size, date: new Date().toLocaleDateString("de-DE"), _file: f }));
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
    setShowForm(false);
    setToast("Selbstauskunft gespeichert ✓");
  }

  async function handleSyncDrive() {
    setUploading(true);
    try {
      await uploadToGoogleDrive(fullName, uploads);
      setToast(`✓ Unterlagen in Google Drive gespeichert`);
    } catch (e) {
      setToast("Fehler beim Upload – bitte erneut versuchen");
    }
    setUploading(false);
  }

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="header">
        <div className="header-label">Mandanten-Übersicht</div>
        <div className="header-title"><em>{fullName}</em></div>
      </div>
      <div className="progress-wrap">
        <div className="progress-header"><span>Fortschritt</span><span>{completedSteps} / {totalSteps} Schritte</span></div>
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
                <div className="upload-actions">
                  {done && <span className="badge badge-success">✓ {files.length}</span>}
                  <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
                    Hochladen
                    <input type="file" className="file-input" multiple onChange={e => handleUpload(dok.id, e.target.files)} />
                  </label>
                </div>
              </div>
              {files.length > 0 && (
                <div className="upload-files-list">
                  {files.map((f, i) => (
                    <div key={i} className="upload-file-item">
                      <div className="upload-file-name"><span>📄</span><span>{f.name}</span></div>
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
      <div className={`selbstauskunft-section${selbstauskunft ? " completed" : ""}`}>
        <div className="section-title">Selbstauskunft</div>
        <div className="section-desc">{selbstauskunft ? "Ausgefüllt." : "Alle Felder ausfüllen."}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {selbstauskunft && <span className="badge badge-success">✓</span>}
          <button className="btn btn-outline btn-sm" onClick={() => setShowForm(true)}>{selbstauskunft ? "Bearbeiten" : "Ausfüllen →"}</button>
        </div>
      </div>
      <div className="divider" />
      <div className={`final-section${!allDone ? " disabled" : ""}`}>
        <div className="final-title">In Google Drive speichern</div>
        <div className="final-desc">{allDone ? "Alle Unterlagen vollständig. Jetzt in Google Drive hochladen." : "Bitte erst alle Pflichtfelder ausfüllen."}</div>
        <button className="btn btn-success" onClick={handleSyncDrive} disabled={uploading}>
          {uploading ? "Lädt hoch…" : "→ Google Drive speichern"}
        </button>
      </div>
      {showForm && <SelbstauskunftModal vorname={vorname} nachname={nachname} existing={selbstauskunft} onSave={handleSaveSA} onClose={() => setShowForm(false)} />}
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
        <div className="login-title">Admin<br /><em style={{ fontFamily: "'DM Serif Display', serif", fontStyle: "italic", color: "var(--accent)" }}>Zugang</em></div>
        <div style={{ marginTop: 32 }}>
          <input className="input-field" type="password" placeholder="Passwort" value={pw}
            onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && check()}
            style={{ width: "100%", marginBottom: 8, borderColor: err ? "var(--accent)" : undefined }} />
          {err && <div style={{ color: "var(--accent)", fontSize: 11, marginBottom: 8 }}>Falsches Passwort</div>}
          <button className="btn" style={{ width: "100%" }} onClick={check}>Einloggen →</button>
        </div>
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
    await saveMandantData(id, { vorname: parts[0], nachname: parts.slice(1).join(" "), uploads: {}, selbstauskunft: null });
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
      <div className="admin-panel">
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
            {Object.entries(mandanten).map(([id, m]) => (
              <div key={id} className="mandant-item">
                <div>
                  <div className="mandant-name">{m.vorname} {m.nachname}</div>
                  <div className="mandant-progress">{getProgress(id)} Schritte</div>
                  <div className="link-display">{generateLink(id)}</div>
                </div>
                <div className="mandant-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => handleCopy(id)}>{copiedId === id ? "✓" : "Link"}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => window.open(generateLink(id), "_blank")}>Öffnen</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(id)}>×</button>
                </div>
              </div>
            ))}
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
