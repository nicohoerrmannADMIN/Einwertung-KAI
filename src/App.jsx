import { useState, useEffect, useRef, useCallback } from "react";

const GOOGLE_CLIENT_ID = "875796881160-8vjs3un1i373mgm1b39rqle53qv3hmbu.apps.googleusercontent.com";
const ADMIN_PASSWORD = "ks2admin2025";
const FOLDER_NAME = "KS2-Mandanten";
const EMAILJS_SERVICE = "service_0jj5ihm";
const EMAILJS_TEMPLATE = "template_mamsnhk";
const EMAILJS_PUBLIC = "KenDwBUdjTdLSbgM-";

// ── Storage ──────────────────────────────────────────────────────
async function loadMandanten() {
  try { const r = localStorage.getItem("mandanten"); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
async function saveMandanten(d) { localStorage.setItem("mandanten", JSON.stringify(d)); }
async function loadMandantData(id) {
  try { const r = localStorage.getItem(`mandant_${id}`); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function saveMandantData(id, d) { localStorage.setItem(`mandant_${id}`, JSON.stringify(d)); }

// ── Utils ────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function genLink(id) { return `${window.location.origin}${window.location.pathname}?mandant=${id}`; }
function getMandantId() { return new URLSearchParams(window.location.search).get("mandant"); }
function euros(n) { const v = parseFloat(String(n).replace(/[^0-9.,]/g,"").replace(",",".")); return isNaN(v) ? 0 : v; }
function fmtEuros(n) { return n === 0 ? "" : n.toLocaleString("de-DE") + " €"; }

// ── Google Drive ─────────────────────────────────────────────────
function loadGsi() {
  return new Promise(res => {
    if (window.google) { res(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = res;
    document.head.appendChild(s);
  });
}
async function getToken() {
  await loadGsi();
  return new Promise((res, rej) => {
    const c = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: r => r.error ? rej(r.error) : res(r.access_token),
    });
    c.requestAccessToken();
  });
}
async function ensureFolder(tok, name, parentId=null) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,{headers:{Authorization:`Bearer ${tok}`}});
  const d = await r.json();
  if (d.files?.length) return d.files[0].id;
  const cr = await fetch("https://www.googleapis.com/drive/v3/files",{method:"POST",headers:{Authorization:`Bearer ${tok}`,"Content-Type":"application/json"},body:JSON.stringify({name,mimeType:"application/vnd.google-apps.folder",...(parentId?{parents:[parentId]}:{})})});
  return (await cr.json()).id;
}
async function uploadFile(tok, file, folderId) {
  const meta = JSON.stringify({name:file.name,parents:[folderId]});
  const form = new FormData();
  form.append("metadata", new Blob([meta],{type:"application/json"}));
  form.append("file", file);
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",{method:"POST",headers:{Authorization:`Bearer ${tok}`},body:form});
}
async function uploadText(tok, filename, content, folderId) {
  const meta = JSON.stringify({name:filename,parents:[folderId]});
  const form = new FormData();
  form.append("metadata", new Blob([meta],{type:"application/json"}));
  form.append("file", new Blob([content],{type:"text/plain;charset=utf-8"}));
  await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",{method:"POST",headers:{Authorization:`Bearer ${tok}`},body:form});
}

// ── CRM Parser ───────────────────────────────────────────────────
function parseCRM(text) {
  const get = (label) => { const m = text.match(new RegExp(`${label}\\s+([^\\n]+)`,"i")); return m?m[1].trim():""; };
  const adR = get("Adresse"); const aL = adR.split(/\s{2,}/);
  return {
    kundennummer: get("Kunde"),
    vorname: get("Vorname"),
    nachname: get("Nachname"),
    geburtsdatum: get("Geburtsdatum"),
    strasse: aL[0]||adR,
    plz_ort: aL[1]||"",
    telefon: text.match(/\+49[\s\d]+/)?.[0]?.trim()||"",
    email: text.match(/[\w.+-]+@[\w.-]+/)?.[0]||"",
    familienstand: get("Familienstand"),
    staatsangehoerigkeit: get("Staatsangehörigkeit"),
    beruf: get("Ausgeübte Tätigkeit"),
  };
}

// ── CSS ──────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0f0e0c;--paper:#f5f2ed;--cream:#ede9e2;--accent:#c8401a;--muted:#8a8680;--line:#d4cfc7;--ok:#2d6a4f;--ok-bg:#e8f4ef;--r:2px}
body{background:var(--paper);color:var(--ink);font-family:'DM Mono',monospace;font-size:13px;min-height:100vh}
.app{max-width:640px;margin:0 auto;padding:40px 20px}
.hdr{margin-bottom:36px;border-bottom:1px solid var(--ink);padding-bottom:18px}
.hdr-sub{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.hdr-title{font-family:'DM Serif Display',serif;font-size:28px;line-height:1.1}
.hdr-title em{font-style:italic;color:var(--accent)}
.card{background:var(--cream);border:1px solid var(--line);padding:22px;margin-bottom:16px}
.card.ok{border-color:var(--ok);background:var(--ok-bg)}
.lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px;display:block}
.row{display:flex;gap:8px;margin-bottom:0}
.ifield{flex:1;padding:10px 12px;border:1px solid var(--line);background:var(--paper);font-family:'DM Mono',monospace;font-size:13px;color:var(--ink);outline:none;border-radius:var(--r)}
.ifield:focus{border-color:var(--ink)}
.ifield.pre{background:#f0f8f0;border-color:var(--ok);color:var(--ok)}
.btn{padding:10px 20px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.05em;cursor:pointer;border-radius:var(--r);transition:all .15s;white-space:nowrap}
.btn:hover{background:var(--accent);border-color:var(--accent)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-o{background:transparent;color:var(--ink)}
.btn-o:hover{background:var(--ink);color:var(--paper)}
.btn-sm{padding:6px 12px;font-size:11px}
.btn-del{border-color:var(--accent);color:var(--accent);background:transparent}
.btn-del:hover{background:var(--accent);color:var(--paper)}
.btn-ok{background:var(--ok);border-color:var(--ok)}
.btn-ok:hover{background:#1d4d39;border-color:#1d4d39}
.upl-item{border:1px solid var(--line);background:var(--paper);margin-bottom:8px}
.upl-item.ok{border-color:var(--ok);background:var(--ok-bg)}
.upl-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;gap:10px;flex-wrap:wrap}
.upl-dot{width:8px;height:8px;border-radius:50%;background:var(--line);flex-shrink:0}
.upl-item.ok .upl-dot{background:var(--ok)}
.upl-lbl{font-weight:500;font-size:12px}
.upl-sub{font-size:10px;color:var(--muted);margin-top:1px}
.upl-hint{font-size:10px;color:var(--accent);margin-top:2px;font-style:italic}
.file-list{padding:0 14px 10px 32px;display:flex;flex-direction:column;gap:3px}
.file-row{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--muted);padding:3px 0;border-top:1px solid var(--line)}
.file-in{display:none}
.pg-wrap{margin-bottom:22px}
.pg-hdr{display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px;color:var(--muted)}
.pg-bar{height:3px;background:var(--line)}
.pg-fill{height:100%;background:var(--ink);transition:width .4s}
.badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 8px;border-radius:99px;font-weight:500}
.badge-ok{background:var(--ok-bg);color:var(--ok)}
.badge-info{background:#f0e8e3;color:var(--accent)}
.divider{height:1px;background:var(--line);margin:20px 0}
.toast{position:fixed;bottom:20px;right:20px;background:var(--ink);color:var(--paper);padding:12px 16px;font-size:12px;z-index:999;max-width:280px}
.m-list{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.m-item{border:1px solid var(--line);background:var(--paper)}
.m-row{display:flex;align-items:flex-start;justify-content:space-between;padding:14px;gap:10px;flex-wrap:wrap}
.m-acts{display:flex;gap:5px;flex-wrap:wrap;align-items:center}
.m-detail{padding:16px;border-top:1px solid var(--line);background:var(--cream)}
.fg{display:flex;flex-direction:column;gap:4px}
.fg .lbl{margin-bottom:3px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.grid2.full{grid-column:1/-1}
.link-s{font-size:10px;color:var(--muted);word-break:break-all;margin-top:3px}
.login-w{max-width:340px;margin:80px auto;padding:0 20px}
.sa-step{max-width:640px;margin:0 auto;padding:40px 20px}
.sa-q{font-family:'DM Serif Display',serif;font-size:22px;margin-bottom:8px;line-height:1.2}
.sa-hint{font-size:12px;color:var(--muted);margin-bottom:20px}
.sa-opts{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.sa-opt{padding:14px 16px;border:1px solid var(--line);background:var(--paper);cursor:pointer;text-align:left;font-family:'DM Mono',monospace;font-size:13px;border-radius:var(--r);transition:all .15s;width:100%}
.sa-opt:hover,.sa-opt.sel{border-color:var(--ink);background:var(--cream)}
.sa-opt.sel{font-weight:500}
.sa-nav{display:flex;justify-content:space-between;margin-top:20px;gap:10px}
.sa-prog{font-size:11px;color:var(--muted);margin-bottom:20px}
.sa-num{font-size:28px;font-weight:500;padding:14px 16px;border:1px solid var(--line);background:var(--paper);width:100%;font-family:'DM Mono',monospace;border-radius:var(--r);outline:none}
.sa-num:focus{border-color:var(--ink)}
.sum-box{background:var(--cream);border:1px solid var(--line);padding:10px 14px;font-size:12px;margin-top:8px;display:flex;justify-content:space-between}
.sum-val{font-weight:500;color:var(--ok)}
.consent-box{border:1px solid var(--line);padding:16px;margin-bottom:16px;background:var(--paper)}
.consent-row{display:flex;gap:12px;align-items:flex-start;cursor:pointer}
.consent-row input{margin-top:2px;flex-shrink:0;width:16px;height:16px;cursor:pointer}
.consent-text{font-size:12px;line-height:1.6}
.done-screen{text-align:center;padding:60px 20px}
.done-icon{font-size:48px;margin-bottom:20px}
.done-title{font-family:'DM Serif Display',serif;font-size:32px;margin-bottom:12px}
.done-sub{color:var(--muted);font-size:14px;line-height:1.6}
.sign-wrap{border:1px solid var(--line);background:white}
.sign-canvas{display:block;cursor:crosshair;touch-action:none;width:100%;max-width:500px}
.sign-foot{display:flex;justify-content:space-between;padding:8px 12px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);align-items:center}
`;

// ── Toast ────────────────────────────────────────────────────────
function Toast({msg,onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t)},[]);
  return <div className="toast">{msg}</div>;
}

// ── Signature Pad ────────────────────────────────────────────────
function SigPad({onSave}) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  function pos(e,c) { const r=c.getBoundingClientRect(),s=e.touches?e.touches[0]:e; return {x:(s.clientX-r.left)*(c.width/r.width),y:(s.clientY-r.top)*(c.height/r.height)}; }
  function start(e){drawing.current=true;last.current=pos(e,ref.current);}
  function move(e){if(!drawing.current)return;e.preventDefault();const c=ref.current,ctx=c.getContext("2d"),p=pos(e,c);ctx.beginPath();ctx.moveTo(last.current.x,last.current.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle="#0f0e0c";ctx.lineWidth=2;ctx.lineCap="round";ctx.stroke();last.current=p;}
  function stop(){drawing.current=false;}
  function clear(){ref.current.getContext("2d").clearRect(0,0,ref.current.width,ref.current.height);}
  return (
    <div className="sign-wrap">
      <canvas ref={ref} className="sign-canvas" width={500} height={120}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}/>
      <div className="sign-foot">
        <span>Hier mit Finger oder Maus unterschreiben</span>
        <span style={{display:"flex",gap:6}}>
          <button className="btn btn-o btn-sm" onClick={clear}>Löschen</button>
          <button className="btn btn-sm" onClick={()=>onSave(ref.current.toDataURL())}>Speichern ✓</button>
        </span>
      </div>
    </div>
  );
}

// ── SA Wizard ────────────────────────────────────────────────────
function SAWizard({crmData, adminData, existing, onSave, onClose}) {
  const initVals = existing || {};
  const [vals, setVals] = useState(initVals);
  const [step, setStep] = useState(0);
  const [sig, setSig] = useState(existing?.signature||null);
  const set = (k,v) => setVals(p=>({...p,[k]:v}));

  // Build steps dynamically
  const steps = [];

  // Step: Berufsstatus
  steps.push({
    id:"berufsstatus", type:"choice",
    q:"Wie bist du aktuell beschäftigt?",
    opts:["Angestellter","Arbeiter","Beamter","öffentlicher Dienst","selbstständig","Rentner","arbeitslos"],
    key:"berufsstatus",
  });

  // Step: Berufsbezeichnung + Arbeitgeber (nur wenn nicht selbstständig/rentner/arbeitslos)
  if (!["selbstständig","Rentner","arbeitslos"].includes(vals.berufsstatus)) {
    steps.push({id:"beruf_detail",type:"multi",q:"Dein Beruf",fields:[
      {key:"berufsbezeichnung",label:"Berufsbezeichnung",placeholder:"z.B. Kaufmann/frau"},
      {key:"arbeitgeber",label:"Arbeitgeber",placeholder:"Firmenname"},
      {key:"beschaeftigt_seit",label:"Beschäftigt seit (MM/JJJJ)",placeholder:"01/2020"},
    ]});
    steps.push({id:"arbeitszeit",type:"choice",q:"Wie arbeitest du?",opts:["Vollzeit","Teilzeit"],key:"arbeitszeit"});
    steps.push({id:"arbeitsverhaeltnis",type:"choice",q:"Art des Arbeitsverhältnisses?",opts:["unbefristet","befristet"],key:"arbeitsverhaeltnis"});
    if (vals.arbeitsverhaeltnis==="befristet") {
      steps.push({id:"befristet_bis",type:"text",q:"Befristung läuft aus am:",key:"befristet_bis",placeholder:"MM/JJJJ",hint:"Bitte Datum eintragen"});
    }
    steps.push({id:"probezeit",type:"choice",q:"Bist du aktuell in der Probezeit?",opts:["Nein","Ja"],key:"probezeit"});
    if (vals.probezeit==="Ja") {
      steps.push({id:"probezeit_bis",type:"text",q:"Probezeit endet am:",key:"probezeit_bis",placeholder:"MM/JJJJ"});
    }
  }
  if (vals.berufsstatus==="selbstständig") {
    steps.push({id:"selbst_seit",type:"text",q:"Selbstständig tätig seit:",key:"selbststaendig_seit",placeholder:"MM/JJJJ"});
  }

  // Familie
  steps.push({id:"familienstand",type:"choice",q:"Familienstand?",opts:["ledig","verheiratet","Lebensgemeinschaft","geschieden","verwitwet","getrennt lebend"],key:"familienstand"});
  if (["verheiratet","Lebensgemeinschaft"].includes(vals.familienstand)) {
    steps.push({id:"gueterstand",type:"choice",q:"Güterstand?",opts:["gesetzlicher Güterstand","Gütertrennung","Gütergemeinschaft"],key:"gueterstand"});
  }
  steps.push({id:"kinder_anzahl",type:"choice",q:"Anzahl unterhaltsberechtigte Kinder?",opts:["0","1","2","3","4","5+"],key:"kinder_anzahl"});
  const nKids = parseInt(vals.kinder_anzahl||"0");
  for (let i=1;i<=Math.min(nKids,5);i++) {
    steps.push({id:`kind_${i}`,type:"multi",q:`Kind ${i}`,fields:[
      {key:`kind${i}_vorname`,label:"Vorname",placeholder:"Vorname"},
      {key:`kind${i}_name`,label:"Nachname",placeholder:"Nachname"},
      {key:`kind${i}_geb`,label:"Geburtsdatum",placeholder:"TT.MM.JJJJ"},
    ]});
  }

  // Einkommen
  const einkFields = [
    {key:"eink_lohn",label:"Lohn/Gehalt netto (monatlich)",placeholder:"3.500"},
    {key:"eink_anzahl_mg",label:"Anzahl Monatsgehälter pro Jahr",placeholder:"12"},
  ];
  if (parseInt(vals.kinder_anzahl||"0")>0) einkFields.push({key:"eink_kindergeld",label:"Gesetzl. Kindergeld (alle Kinder gesamt)",placeholder:"250"});
  einkFields.push(
    {key:"eink_unterhalt_k",label:"Unterhalt Kinder (eingehend, gesamt)",placeholder:"0"},
    {key:"eink_kapital",label:"Kapitaleinkünfte (Depot, Zinsen etc.)",placeholder:"0"},
    {key:"eink_selbst",label:"Einkünfte aus Selbstständigkeit",placeholder:"0"},
    {key:"eink_miete",label:"Mieteinnahmen (kalt)",placeholder:"0"},
    {key:"eink_rente",label:"Renten (BU, gesetzl., Pension etc.)",placeholder:"0"},
    {key:"eink_sonstige",label:"Sonstige Einnahmen",placeholder:"0"},
  );
  steps.push({id:"einkommen",type:"sumFields",q:"Monatliches Nettoeinkommen",hint:"Alle Angaben in € pro Monat",fields:einkFields,sumKeys:["eink_lohn","eink_kindergeld","eink_unterhalt_k","eink_kapital","eink_selbst","eink_miete","eink_rente","eink_sonstige"]});

  // Ausgaben
  steps.push({id:"ausgaben",type:"sumFields",q:"Monatliche Ausgaben",hint:"Alle Angaben in € pro Monat",fields:[
    {key:"ausg_miete",label:"Miete (entfällt bei Kauf)",placeholder:"850"},
    {key:"ausg_nk",label:"Nebenkosten",placeholder:"200"},
    {key:"ausg_vers",label:"Versicherungen / Bauspar / Riester",placeholder:"350"},
    {key:"ausg_pkv",label:"Private Krankenversicherung",placeholder:"0"},
    {key:"ausg_darlehen",label:"Bestehende Darlehen (monatl. Rate)",placeholder:"0"},
    {key:"ausg_raten",label:"Sonstige Ratenverpflichtungen",placeholder:"0"},
    {key:"ausg_unterhalt",label:"Unterhaltszahlungen (ausgehend)",placeholder:"0"},
    {key:"ausg_altersvorsorge",label:"Altersvorsorge (Selbstständige)",placeholder:"0"},
    {key:"ausg_sonstige",label:"Sonstige Ausgaben",placeholder:"0"},
  ],sumKeys:["ausg_miete","ausg_nk","ausg_vers","ausg_pkv","ausg_darlehen","ausg_raten","ausg_unterhalt","ausg_altersvorsorge","ausg_sonstige"]});

  // Rente
  steps.push({id:"rente",type:"sumFields",q:"Rentenansprüche (Schätzung)",hint:"Ungefähre monatliche Beträge – grobe Schätzung reicht",fields:[
    {key:"rente_gesetzlich",label:"Gesetzliche Rente (ca.)",placeholder:"800"},
    {key:"rente_privat",label:"Private Renten / LV-Auszahlung (ca.)",placeholder:"0"},
  ],sumKeys:["rente_gesetzlich","rente_privat"]});

  // Vermögen
  steps.push({id:"vermoegen",type:"sumFields",q:"Vorhandenes Vermögen",hint:"Aktuelle Werte in €",fields:[
    {key:"verm_immobilien",label:"Immobilien (Verkehrswert)",placeholder:"0"},
    {key:"verm_bank",label:"Bank- & Sparguthaben",placeholder:"0"},
    {key:"verm_wertpapiere",label:"Wertpapiere / Depot (Kurswert)",placeholder:"0"},
    {key:"verm_bausparer",label:"Bausparvertrag",placeholder:"0"},
    {key:"verm_versicherung",label:"Lebensversicherung (Rückkaufswert)",placeholder:"0"},
    {key:"verm_sonstiges",label:"Sonstiges Vermögen",placeholder:"0"},
  ],sumKeys:["verm_immobilien","verm_bank","verm_wertpapiere","verm_bausparer","verm_versicherung","verm_sonstiges"]});

  // Einsetzbares Kapital
  steps.push({id:"einsetzbar",type:"text",q:"Wie viel Kapital könntest du einsetzen?",hint:"Einsetzbares Kapital = der Betrag, den du tatsächlich für den Immobilienkauf verfügbar machen könntest (Eigenkapital, das du bereit bist einzusetzen).",key:"einsetzbar",placeholder:"30.000"});

  // Verbindlichkeiten
  steps.push({id:"verbindlichkeiten",type:"sumFields",q:"Bestehende Verbindlichkeiten",hint:"Aktuelle Restschulden in €",fields:[
    {key:"verb_hypotheken",label:"Hypotheken / Grundschulden",placeholder:"0"},
    {key:"verb_kredite",label:"Bank- / Privatkredite",placeholder:"0"},
    {key:"verb_sonstige",label:"Sonstige Verbindlichkeiten",placeholder:"0"},
    {key:"verb_buergschaften",label:"Übernommene Bürgschaften",placeholder:"0"},
  ],sumKeys:["verb_hypotheken","verb_kredite","verb_sonstige","verb_buergschaften"]});

  // Unterschrift
  steps.push({id:"unterschrift",type:"signature",q:"Unterschrift",hint:"Bitte unterschreibe hier zur Bestätigung deiner Angaben."});

  const cur = steps[step] || steps[steps.length-1];
  const total = steps.length;

  function next() { if (step < total-1) setStep(s=>s+1); }
  function back() { if (step > 0) setStep(s=>s-1); }

  function canNext() {
    if (!cur) return false;
    if (cur.type==="choice") return !!vals[cur.key];
    if (cur.type==="text") return !!(vals[cur.key]||"").trim();
    if (cur.type==="multi") return cur.fields.every(f=>!!(vals[f.key]||"").trim());
    if (cur.type==="sumFields") return true; // optional fields ok
    if (cur.type==="signature") return !!sig;
    return true;
  }

  function computeSum(keys) {
    return keys.reduce((a,k)=>a+euros(vals[k]||"0"),0);
  }

  function handleSave() {
    onSave({...vals, signature: sig});
  }

  const isLast = step === total-1;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,14,12,0.8)",overflowY:"auto",zIndex:100,padding:"20px"}}>
      <div style={{background:"var(--paper)",maxWidth:560,margin:"0 auto",border:"1px solid var(--ink)",padding:"28px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div className="sa-prog">Schritt {step+1} von {total}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"var(--muted)"}}>×</button>
        </div>
        <div className="pg-bar" style={{marginBottom:24}}><div className="pg-fill" style={{width:`${((step+1)/total)*100}%`}}/></div>

        {cur.type==="choice" && (
          <div>
            <div className="sa-q">{cur.q}</div>
            <div className="sa-opts">
              {cur.opts.map(o=>(
                <button key={o} className={`sa-opt${vals[cur.key]===o?" sel":""}`} onClick={()=>{set(cur.key,o);setTimeout(next,200);}}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {cur.type==="text" && (
          <div>
            <div className="sa-q">{cur.q}</div>
            {cur.hint && <div className="sa-hint">{cur.hint}</div>}
            <input className="sa-num" value={vals[cur.key]||""} onChange={e=>set(cur.key,e.target.value)} placeholder={cur.placeholder||""} autoFocus />
          </div>
        )}

        {cur.type==="multi" && (
          <div>
            <div className="sa-q">{cur.q}</div>
            {cur.fields.map(f=>(
              <div key={f.key} style={{marginBottom:12}}>
                <div className="lbl">{f.label}</div>
                <input className="ifield" style={{width:"100%"}} value={vals[f.key]||""} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder||""}/>
              </div>
            ))}
          </div>
        )}

        {cur.type==="sumFields" && (
          <div>
            <div className="sa-q">{cur.q}</div>
            {cur.hint && <div className="sa-hint">{cur.hint}</div>}
            {cur.fields.map(f=>(
              <div key={f.key} style={{marginBottom:10}}>
                <div className="lbl">{f.label}</div>
                <input className="ifield" style={{width:"100%"}} value={vals[f.key]||""} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder||"0"} type="text" inputMode="decimal"/>
              </div>
            ))}
            <div className="sum-box">
              <span>Gesamt</span>
              <span className="sum-val">{fmtEuros(computeSum(cur.sumKeys))}</span>
            </div>
          </div>
        )}

        {cur.type==="signature" && (
          <div>
            <div className="sa-q">{cur.q}</div>
            <div className="sa-hint">{cur.hint}</div>
            {sig
              ? <div style={{marginBottom:12}}>
                  <img src={sig} alt="Unterschrift" style={{maxWidth:280,border:"1px solid var(--line)"}}/>
                  <br/><button className="btn btn-o btn-sm" style={{marginTop:8}} onClick={()=>setSig(null)}>Neu unterschreiben</button>
                </div>
              : <SigPad onSave={setSig}/>
            }
          </div>
        )}

        <div className="sa-nav">
          <button className="btn btn-o btn-sm" onClick={back} disabled={step===0}>← Zurück</button>
          {isLast
            ? <button className="btn btn-sm" disabled={!canNext()} onClick={handleSave}>Speichern ✓</button>
            : <button className="btn btn-sm" disabled={!canNext()} onClick={next}>Weiter →</button>
          }
        </div>
      </div>
    </div>
  );
}

// ── Dokument Kategorien (Mandantenseite) ─────────────────────────
const DOCS = [
  { id:"eigenkapital", label:"Eigenkapitalnachweis", sublabel:"Kontoauszug oder Depotauszug", hint:"Wichtig: Name, Datum und Vermögensbetrag in € müssen auf der gleichen Seite erkennbar sein.", required:true },
  { id:"steuerbescheid", label:"Steuerbescheid", sublabel:"Aktuellster vorliegender Bescheid", hint:null, required:true, noDoc:true, noDocLabel:"Ich habe keinen Steuerbescheid (keine Steuererklärung abgegeben)" },
  { id:"lohn1", label:"Gehaltsnachweis", sublabel:"Letzter vollständiger Monat", hint:"Foto direkt mit der Kamera möglich.", required:true, camera:true },
  { id:"lohn2", label:"Gehaltsnachweis", sublabel:"Vorletzter vollständiger Monat", hint:null, required:true, camera:true },
  { id:"lohn3", label:"Gehaltsnachweis", sublabel:"Drittletzter vollständiger Monat", hint:null, required:true, camera:true },
];

// ── Mandant Page ─────────────────────────────────────────────────
function MandantPage({mandantId}) {
  const [data, setData] = useState(null);
  const [showSA, setShowSA] = useState(false);
  const [consent, setConsent] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(()=>{ loadMandantData(mandantId).then(d=>{ if(d) setData(d); }); },[mandantId]);

  if (!data) return <div className="app"><style>{CSS}</style><div style={{color:"var(--muted)",paddingTop:48}}>Lade…</div></div>;

  const {vorname,nachname,uploads={},selbstauskunft=null,crmData=null,adminData={}} = data;
  const fullName = `${vorname} ${nachname}`;

  const reqDocs = DOCS.filter(d=>d.required);
  const doneReq = reqDocs.filter(d=>(uploads[d.id]?.length??0)>0 || uploads[`${d.id}_nodoc`]).length;
  const totalSteps = reqDocs.length + 1; // +SA
  const doneSteps = doneReq + (selbstauskunft?1:0);
  const pct = Math.round((doneSteps/totalSteps)*100);
  const allDone = doneSteps===totalSteps && consent;

  async function handleUpload(docId, files) {
    const fl = Array.from(files).map(f=>({name:f.name,date:new Date().toLocaleDateString("de-DE"),_file:f}));
    const newU = {...uploads,[docId]:[...(uploads[docId]??[]),...fl]};
    const nd = {...data,uploads:newU};
    setData(nd); await saveMandantData(mandantId,nd);
    setToast(`${fl.length} Datei(en) gespeichert`);
  }

  async function handleNoDoc(docId) {
    const newU = {...uploads,[`${docId}_nodoc`]:true};
    const nd = {...data,uploads:newU};
    setData(nd); await saveMandantData(mandantId,nd);
    setToast("Bestätigt ✓");
  }

  async function handleRemove(docId, idx) {
    const nl = uploads[docId].filter((_,i)=>i!==idx);
    const nd = {...data,uploads:{...uploads,[docId]:nl}};
    setData(nd); await saveMandantData(mandantId,nd);
  }

  async function handleUndoNoDoc(docId) {
    const newU = {...uploads};
    delete newU[`${docId}_nodoc`];
    const nd = {...data,uploads:newU};
    setData(nd); await saveMandantData(mandantId,nd);
  }

  async function handleSaveSA(vals) {
    const nd = {...data,selbstauskunft:vals};
    setData(nd); await saveMandantData(mandantId,nd);
    setShowSA(false); setToast("Selbstauskunft gespeichert ✓");
  }

  function handleDownloadAll() {
    const allFiles = Object.values(uploads).flat().filter(f => f && f._file);
    if (allFiles.length === 0) { setToast("Keine Dateien zum Herunterladen"); return; }
    allFiles.forEach((f, i) => {
      setTimeout(() => {
        const url = URL.createObjectURL(f._file);
        const a = document.createElement("a");
        a.href = url; a.download = f.name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, i * 300);
    });
    setToast(`${allFiles.length} Datei(en) werden heruntergeladen`);
  }

  async function handleSubmit() {
    setUploading(true);
    try {
      // Build SA summary
      const saLines = selbstauskunft ? Object.entries(selbstauskunft)
        .filter(([k,v])=>k!=="signature"&&v)
        .map(([k,v])=>`${k}: ${v}`)
        .join("\n") : "Nicht ausgefüllt";

      // Build upload list
      const uploadList = DOCS.map(d=>{
        const files = uploads[d.id]??[];
        const noDoc = uploads[`${d.id}_nodoc`];
        if (noDoc) return `${d.label}: Kein Dokument vorhanden`;
        if (files.length>0) return `${d.label}: ${files.map(f=>f.name).join(", ")}`;
        return `${d.label}: Nicht hochgeladen`;
      }).join("\n");

      // Load emailjs
      if (!window.emailjs) {
        await new Promise((res,rej)=>{
          const s=document.createElement("script");
          s.src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
          s.onload=res; s.onerror=rej;
          document.head.appendChild(s);
        });
        window.emailjs.init({publicKey: EMAILJS_PUBLIC});
      }

      await window.emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
        title: `Einwertung – ${fullName}`,
        name: fullName,
        email: "einwertung@ks2.de",
        message: `Neue Unterlagen eingereicht von: ${fullName}\n\n=== HOCHGELADENE DOKUMENTE ===\n${uploadList}\n\n=== SELBSTAUSKUNFT ===\n${saLines}`,
      });

      setDone(true);
    } catch(e) {
      console.error(e);
      setToast("Fehler beim Einreichen – bitte erneut versuchen");
    }
    setUploading(false);
  }

  if (done) return (
    <div className="app"><style>{CSS}</style>
      <div className="done-screen">
        <div className="done-icon">✅</div>
        <div className="done-title">Vielen Dank!</div>
        <div className="done-sub">Ihre Unterlagen wurden erfolgreich eingereicht.<br/>Wir melden uns schnellstmöglich bei Ihnen.</div>
      </div>
    </div>
  );

  return (
    <div className="app"><style>{CSS}</style>
      <div className="hdr">
        <div className="hdr-sub">Meine Unterlagen für den Einwertungsprozess</div>
        <div className="hdr-title"><em>{fullName}</em></div>
      </div>

      <div className="pg-wrap">
        <div className="pg-hdr"><span>Fortschritt</span><span>{doneSteps} / {totalSteps}</span></div>
        <div className="pg-bar"><div className="pg-fill" style={{width:`${pct}%`}}/></div>
      </div>

      <span className="lbl">Unterlagen hochladen</span>
      {DOCS.map(dok=>{
        const files = uploads[dok.id]??[];
        const noDoc = !!uploads[`${dok.id}_nodoc`];
        const ok = files.length>0||noDoc;
        return (
          <div key={dok.id} className={`upl-item${ok?" ok":""}`}>
            <div className="upl-hdr">
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="upl-dot"/>
                <div>
                  <div className="upl-lbl">{dok.label}{dok.required&&<span style={{color:"var(--accent)",marginLeft:4}}>*</span>}</div>
                  <div className="upl-sub">{dok.sublabel}</div>
                  {dok.hint&&!ok&&<div className="upl-hint">ℹ {dok.hint}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                {ok&&<span className="badge badge-ok">✓</span>}
                {!noDoc&&(
                  <label className="btn btn-o btn-sm" style={{cursor:"pointer"}}>
                    {dok.camera?"📷 Foto/Upload":"Hochladen"}
                    <input type="file" className="file-in" multiple accept="image/*,application/pdf" capture={dok.camera?"environment":undefined} onChange={e=>handleUpload(dok.id,e.target.files)}/>
                  </label>
                )}
              </div>
            </div>
            {dok.noDoc&&!noDoc&&files.length===0&&(
              <div style={{padding:"0 14px 12px 32px"}}>
                <button className="btn btn-o btn-sm" onClick={()=>handleNoDoc(dok.id)}>☐ {dok.noDocLabel}</button>
              </div>
            )}
            {noDoc&&(
              <div style={{padding:"0 14px 12px 32px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"var(--ok)"}}>☑ {dok.noDocLabel}</span>
                <button className="btn btn-del btn-sm" onClick={()=>handleUndoNoDoc(dok.id)}>Rückgängig</button>
              </div>
            )}
            {files.length>0&&(
              <div className="file-list">
                {files.map((f,i)=>(
                  <div key={i} className="file-row">
                    <span>📄 {f.name}</span>
                    <button className="btn btn-del btn-sm" onClick={()=>handleRemove(dok.id,i)}>Entfernen</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="divider"/>

      <div className={`card${selbstauskunft?" ok":""}`}>
        <div style={{fontFamily:"'DM Serif Display',serif",fontSize:20,marginBottom:4}}>Selbstauskunft</div>
        <div style={{color:"var(--muted)",fontSize:11,marginBottom:14}}>
          {selbstauskunft?"Ausgefüllt und gespeichert.":"Bitte alle Angaben zu Beruf, Einkommen und Vermögen machen."}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {selbstauskunft&&<span className="badge badge-ok">✓</span>}
          <button className="btn btn-o btn-sm" onClick={()=>setShowSA(true)}>
            {selbstauskunft?"Bearbeiten":"Ausfüllen →"}
          </button>
        </div>
      </div>

      <div className="divider"/>

      <div className="consent-box">
        <label className="consent-row">
          <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
          <span className="consent-text">
            <strong>Einwilligung zur Datenverarbeitung *</strong><br/>
            Ich willige ein, dass meine personenbezogenen Daten ausschließlich zum Zweck der Immobilien-Einwertung und Finanzierungsvermittlung verarbeitet werden. Die Daten werden streng vertraulich behandelt, nicht an Dritte weitergegeben und nach Abschluss des Prozesses nach den gesetzlichen Aufbewahrungsfristen gelöscht. Grundlage ist Art. 6 Abs. 1 a) DS-GVO.
          </span>
        </label>
      </div>

      <button className="btn btn-ok" style={{width:"100%",padding:"14px",fontSize:14}} onClick={handleSubmit} disabled={!allDone||uploading}>
        {uploading?"Wird eingereicht…":"Unterlagen einreichen →"}
      </button>
      {!allDone&&<div style={{fontSize:11,color:"var(--muted)",textAlign:"center",marginTop:8}}>
        {!consent?"Bitte Datenschutzerklärung bestätigen":"Bitte alle Pflichtfelder ausfüllen"}
      </div>}

      {Object.values(uploads).flat().filter(f=>f&&f._file).length > 0 && (
        <button className="btn btn-o" style={{width:"100%",marginTop:10}} onClick={handleDownloadAll}>
          ⬇ Alle Dokumente herunterladen
        </button>
      )}

      {showSA&&<SAWizard crmData={crmData} adminData={adminData} existing={selbstauskunft} onSave={handleSaveSA} onClose={()=>setShowSA(false)}/>}
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}

// ── Admin Login ──────────────────────────────────────────────────
function AdminLogin({onLogin}) {
  const [pw,setPw]=useState("");const [err,setErr]=useState(false);
  function check(){if(pw===ADMIN_PASSWORD){sessionStorage.setItem("ks2admin","1");onLogin();}else{setErr(true);setTimeout(()=>setErr(false),2000);}}
  return(
    <div className="app"><style>{CSS}</style>
      <div className="login-w">
        <div className="hdr-sub">KS2 · Immobilien</div>
        <div style={{fontFamily:"'DM Serif Display',serif",fontSize:28,marginBottom:24}}>Admin<br/><em style={{fontStyle:"italic",color:"var(--accent)"}}>Zugang</em></div>
        <input className="ifield" type="password" placeholder="Passwort" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&check()} style={{width:"100%",marginBottom:8,borderColor:err?"var(--accent)":undefined}}/>
        {err&&<div style={{color:"var(--accent)",fontSize:11,marginBottom:8}}>Falsches Passwort</div>}
        <button className="btn" style={{width:"100%"}} onClick={check}>Einloggen →</button>
      </div>
    </div>
  );
}

// ── Admin Page ───────────────────────────────────────────────────
function AdminPage() {
  const [mandanten,setMandanten]=useState({});
  const [name,setName]=useState("");
  const [copiedId,setCopiedId]=useState(null);
  const [toast,setToast]=useState(null);
  const [details,setDetails]=useState({});
  const [expandedId,setExpandedId]=useState(null);

  useEffect(()=>{
    loadMandanten().then(m=>{
      setMandanten(m);
      Object.keys(m).forEach(id=>{ loadMandantData(id).then(d=>{if(d)setDetails(p=>({...p,[id]:d}));}); });
    });
  },[]);

  async function handleCreate(){
    const t=name.trim();if(!t)return;
    const p=t.split(" ");const id=genId();
    const nm={...mandanten,[id]:{vorname:p[0],nachname:p.slice(1).join(" "),createdAt:new Date().toISOString()}};
    await saveMandanten(nm);
    await saveMandantData(id,{vorname:p[0],nachname:p.slice(1).join(" "),uploads:{},selbstauskunft:null,crmData:null,adminData:{}});
    setMandanten(nm);setName("");setToast(`${t} angelegt ✓`);
  }

  async function handleDelete(id){const nm={...mandanten};delete nm[id];await saveMandanten(nm);setMandanten(nm);}

  function handleCopy(id){navigator.clipboard.writeText(genLink(id));setCopiedId(id);setTimeout(()=>setCopiedId(null),2000);}

  async function handleCRMUpload(id,file){
    const text=await file.text();const parsed=parseCRM(text);
    const d=await loadMandantData(id);const nd={...d,crmData:parsed};
    await saveMandantData(id,nd);setDetails(p=>({...p,[id]:nd}));setToast("CRM-Daten importiert ✓");
  }

  async function handlePersoUpload(id,file){
    // Use Claude API to extract data from ID document
    const toBase64=(f)=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
    const b64=await toBase64(file);
    const mediaType=file.type||"image/jpeg";
    setToast("Ausweis wird ausgelesen…");
    try {
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:mediaType,data:b64}},
            {type:"text",text:"Lies alle Daten aus diesem deutschen Personalausweis oder Reisepass aus. Antworte NUR mit einem JSON-Objekt mit diesen Feldern: vorname, nachname, geburtsname, geburtsdatum, geburtsort, strasse, plz_ort, staatsangehoerigkeit, ausweis_nr, ausstellungsbehoerde, ausstellungsdatum, gueltig_bis. Leere Felder als leeren String. Kein Markdown, kein Text drumherum."}
          ]}]
        })
      });
      const data=await resp.json();
      const raw=data.content?.[0]?.text||"{}";
      const clean=raw.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      const d=await loadMandantData(id);
      const nd={...d,adminData:{...(d.adminData||{}),...parsed}};
      await saveMandantData(id,nd);setDetails(p=>({...p,[id]:nd}));
      setToast("Ausweis-Daten ausgelesen ✓ – bitte prüfen!");
    } catch(e){setToast("Fehler beim Auslesen – bitte manuell eintragen");}
  }

  async function handleAdminField(id,key,value){
    const d=await loadMandantData(id);
    const nd={...d,adminData:{...(d.adminData||{}),[key]:value}};
    await saveMandantData(id,nd);setDetails(p=>({...p,[id]:nd}));
  }

  function getProgress(id){
    const d=details[id];if(!d)return"…";
    const req=DOCS.filter(x=>x.required);
    const done=req.filter(x=>(d.uploads?.[x.id]?.length??0)>0||d.uploads?.[`${x.id}_nodoc`]).length;
    return`${done+(d.selbstauskunft?1:0)} / ${req.length+1}`;
  }

  const adminFields = [
    {key:"ausweis_nr",label:"Ausweis-Nr."},
    {key:"ausstellungsbehoerde",label:"Ausstellungsbehörde"},
    {key:"ausstellungsdatum",label:"Ausstellungsdatum"},
    {key:"gueltig_bis",label:"Gültig bis"},
    {key:"geburtsort",label:"Geburtsort"},
    {key:"geburtsname",label:"Geburtsname"},
    {key:"strasse",label:"Straße, Hausnr."},
    {key:"plz_ort",label:"PLZ, Ort"},
    {key:"wohnhaft_seit",label:"Wohnhaft seit"},
    {key:"iban",label:"IBAN"},
    {key:"bic",label:"BIC"},
    {key:"bank_seit",label:"Bankverbindung seit"},
  ];

  return (
    <div className="app"><style>{CSS}</style>
      <div className="hdr">
        <div className="hdr-sub">KS2 · Immobilien Einwertung</div>
        <div className="hdr-title">Mandanten<br/><em>verwalten</em></div>
      </div>

      <div className="card">
        <span className="lbl">Neuen Mandanten anlegen</span>
        <div className="row">
          <input className="ifield" placeholder="Max Mustermann" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleCreate()}/>
          <button className="btn" onClick={handleCreate}>Anlegen →</button>
        </div>
      </div>

      {Object.keys(mandanten).length>0&&(
        <>
          <span className="lbl">Aktive Mandanten</span>
          <div className="m-list">
            {Object.entries(mandanten).map(([id,m])=>{
              const d=details[id];const exp=expandedId===id;
              return(
                <div key={id} className="m-item">
                  <div className="m-row">
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <strong>{m.vorname} {m.nachname}</strong>
                        {d?.crmData&&<span className="badge badge-ok">CRM</span>}
                        {d?.adminData?.ausweis_nr&&<span className="badge badge-ok">Perso</span>}
                        {d?.adminData?.iban&&<span className="badge badge-ok">IBAN</span>}
                      </div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{getProgress(id)} Schritte</div>
                      <div className="link-s">{genLink(id)}</div>
                    </div>
                    <div className="m-acts">
                      <button className="btn btn-o btn-sm" onClick={()=>setExpandedId(exp?null:id)}>{exp?"▲":"Details ▼"}</button>
                      <button className="btn btn-o btn-sm" onClick={()=>handleCopy(id)}>{copiedId===id?"✓":"Link"}</button>
                      <button className="btn btn-o btn-sm" onClick={()=>window.open(genLink(id),"_blank")}>Öffnen</button>
                      <button className="btn btn-del btn-sm" onClick={()=>handleDelete(id)}>×</button>
                    </div>
                  </div>

                  {exp&&(
                    <div className="m-detail">
                      <span className="lbl">CRM-Import</span>
                      <label className="btn btn-o btn-sm" style={{cursor:"pointer",display:"inline-block",marginBottom:10}}>
                        📂 CRM-Datei (.txt)
                        <input type="file" className="file-in" accept=".txt,.pdf" onChange={e=>handleCRMUpload(id,e.target.files[0])}/>
                      </label>
                      {d?.crmData&&<div style={{fontSize:11,color:"var(--ok)",marginBottom:12}}>✓ {d.crmData.vorname} {d.crmData.nachname} · {d.crmData.email}</div>}

                      <span className="lbl" style={{marginTop:14}}>Personalausweis-Daten (von Ausweis übertragen)</span>
                      <div className="grid2">
                        {adminFields.map(f=>(
                          <div key={f.key} className="fg">
                            <span className="lbl">{f.label}</span>
                            <input className="ifield" value={d?.adminData?.[f.key]||""} onChange={e=>handleAdminField(id,f.key,e.target.value)} placeholder={f.label}/>
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
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────
export default function App() {
  const mandantId=getMandantId();
  const [adminAuth,setAdminAuth]=useState(()=>sessionStorage.getItem("ks2admin")==="1");
  if (mandantId) return <MandantPage mandantId={mandantId}/>;
  if (!adminAuth) return <AdminLogin onLogin={()=>setAdminAuth(true)}/>;
  return <AdminPage/>;
}
