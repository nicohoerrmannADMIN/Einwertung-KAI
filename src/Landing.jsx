import { useState } from "react";
import App from "./App.jsx";
import Planung from "./Planung.jsx";

const PASSWORD = "ks2admin2025";

export default function Landing() {
  const [auth, setAuth] = useState(!!sessionStorage.getItem("landing_auth"));
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  function check() {
    if (pw === PASSWORD) {
      sessionStorage.setItem("landing_auth", "1");
      setAuth(true);
    } else {
      setError(true);
    }
  }

  if (auth && view === "einwertung") return <App />;
  if (auth && view === "planung") return <Planung />;

  if (!auth) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0f1e",gap:20}}>
      <div style={{color:"#c8a96e",fontSize:11,letterSpacing:"0.2em",textTransform:"uppercase"}}>Projekt 1030</div>
      <div style={{color:"#f0ece4",fontFamily:"serif",fontSize:28}}>Startseite</div>
      <input
        type="password"
        placeholder="Passwort"
        value={pw}
        onChange={e => setPw(e.target.value)}
        onKeyDown={e => { if(e.key==="Enter") check(); }}
        style={{padding:"12px 20px",borderRadius:4,border:"1px solid rgba(200,169,110,0.3)",background:"#1a2236",color:"#f0ece4",fontSize:16,outline:"none",width:260,textAlign:"center"}}
      />
      {error && <div style={{color:"#f87171",fontSize:13}}>Falsches Passwort</div>}
      <button onClick={check} style={{background:"linear-gradient(135deg,#c8a96e,#e8c98e)",color:"#0a0f1e",border:"none",padding:"12px 32px",borderRadius:4,fontWeight:600,cursor:"pointer",fontSize:14}}>
        Anmelden
      </button>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0f1e",gap:32}}>
      <di
